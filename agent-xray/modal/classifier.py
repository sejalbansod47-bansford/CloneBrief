"""Optional inference-only prompt-injection signal for Agent Trap X-ray."""
import modal

MODEL = "protectai/deberta-v3-base-prompt-injection-v2"


def download_weights():
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    AutoTokenizer.from_pretrained(MODEL).save_pretrained("/model")
    AutoModelForSequenceClassification.from_pretrained(MODEL).save_pretrained("/model")


image = (modal.Image.debian_slim(python_version="3.11")
         .pip_install("torch", "transformers", "sentencepiece", "fastapi[standard]")
         .run_function(download_weights))
app = modal.App("clonebrief-xray")


@app.cls(image=image, gpu="T4", scaledown_window=300, enable_memory_snapshot=True)
class Classifier:
    @modal.enter(snap=True)
    def load(self):
        from transformers import AutoModelForSequenceClassification, AutoTokenizer
        self.tokenizer = AutoTokenizer.from_pretrained("/model", local_files_only=True)
        self.model = AutoModelForSequenceClassification.from_pretrained("/model", local_files_only=True).eval()
        labels = {str(v).upper(): int(k) for k, v in self.model.config.id2label.items()}
        if "INJECTION" not in labels:
            raise RuntimeError("Expected explicit INJECTION label")
        self.injection_index = labels["INJECTION"]

    @modal.enter(snap=False)
    def move_to_gpu(self):
        self.model.to("cuda")

    @modal.fastapi_endpoint(method="POST", requires_proxy_auth=True)
    def classify(self, body: dict):
        import torch
        from fastapi import HTTPException
        chunks = body.get("chunks")
        if (not isinstance(chunks, list) or len(chunks) > 64
                or any(not isinstance(c, dict) or not isinstance(c.get("id"), str)
                       or len(c["id"]) > 4096 or not isinstance(c.get("text"), str)
                       or len(c["text"]) > 2000 for c in chunks)):
            raise HTTPException(400, "Expected at most 64 chunks of at most 2000 characters")
        results = []
        with torch.inference_mode():
            for chunk in chunks:
                inputs = self.tokenizer(chunk["text"], return_tensors="pt", truncation=True, max_length=512).to("cuda")
                score = self.model(**inputs).logits.softmax(dim=-1)[0, self.injection_index].item()
                results.append({"id": chunk["id"], "label": "INJECTION" if score >= 0.5 else "BENIGN", "score": score})
        return {"results": results}
