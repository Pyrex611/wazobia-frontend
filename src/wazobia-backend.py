import os
import torch
import logging
import base64
import uuid
import nest_asyncio
import uvicorn
from io import BytesIO
from gtts import gTTS
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from transformers import pipeline, AutoModelForSeq2SeqLM, AutoTokenizer
from pyngrok import ngrok

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("Wazobia-Backend")

class TranslationEngine:
    def __init__(self):
        self.device = "cuda:0" if torch.cuda.is_available() else "cpu"
        self.whisper_model = "openai/whisper-base"
        self.nllb_model = "facebook/nllb-200-distilled-600M"
        self.transcriber = None
        self.translator_model = None
        self.translator_tokenizer = None
        
        # Mapping NLLB codes to Whisper language names
        self.nllb_to_whisper = {
            'eng_Latn': 'english', 'yor_Latn': 'yoruba', 'hau_Latn': 'hausa',
            'ibo_Latn': 'igbo', 'fra_Latn': 'french', 'spa_Latn': 'spanish',
            'deu_Latn': 'german', 'ita_Latn': 'italian', 'por_Latn': 'portuguese',
            'rus_Cyrl': 'russian', 'jpn_Jpan': 'japanese', 'kor_Kore': 'korean',
            'arb_Arab': 'arabic', 'hin_Deva': 'hindi', 'tur_Latn': 'turkish',
            'vie_Latn': 'vietnamese', 'nld_Latn': 'dutch', 'pol_Latn': 'polish',
            'swe_Latn': 'swedish', 'ind_Latn': 'indonesian'
        }

    def load_models(self):
        logger.info(f"Loading Models on {self.device}...")
        self.transcriber = pipeline("automatic-speech-recognition", model=self.whisper_model, device=self.device)
        self.translator_tokenizer = AutoTokenizer.from_pretrained(self.nllb_model)
        self.translator_model = AutoModelForSeq2SeqLM.from_pretrained(self.nllb_model).to(self.device)

    def process(self, audio_path, src_lang, tgt_lang):
        # 1. Transcription with Language Hint
        whisper_lang = self.nllb_to_whisper.get(src_lang, 'english')
        ts_result = self.transcriber(audio_path, generate_kwargs={"language": whisper_lang, "task": "transcribe"})
        transcript = ts_result.get("text", "").strip()
        if not transcript: 
            return None, None, None

        # 2. Translation
        # Fix: Separated inputs and used lang_code_to_id for robustness with NLLB
        inputs = self.translator_tokenizer(transcript, return_tensors="pt").to(self.device)
        
        # Ensure we get the correct ID for the target language (NLLB specific)
        if tgt_lang in self.translator_tokenizer.lang_code_to_id:
            forced_bos_id = self.translator_tokenizer.lang_code_to_id[tgt_lang]
        else:
            # Fallback for unexpected codes
            forced_bos_id = self.translator_tokenizer.lang_code_to_id.get("eng_Latn")

        translated_tokens = self.translator_model.generate(
            **inputs, 
            forced_bos_token_id=forced_bos_id, 
            max_length=400
        )
        translated_text = self.translator_tokenizer.batch_decode(translated_tokens, skip_special_tokens=True)[0]

        # 3. Text-to-Speech
        clean_lang = tgt_lang.split('_')[0][:2] # e.g., 'eng' -> 'en'
        # Fallback to English if gTTS likely doesn't support the code (e.g. Yoruba/Hausa might fail)
        if clean_lang not in ['en', 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ja', 'ko', 'ar', 'hi', 'tr', 'vi', 'nl', 'pl', 'sv', 'id']:
             # Attempt with raw code, if fail, fallback to English to prevent crash
             pass 

        try:
            tts = gTTS(text=translated_text, lang=clean_lang)
            fp = BytesIO()
            tts.write_to_fp(fp)
            audio_b64 = base64.b64encode(fp.getvalue()).decode()
        except Exception:
            # If specific lang fails, try English or just return silent
            try:
                tts = gTTS(text=translated_text, lang='en')
                fp = BytesIO()
                tts.write_to_fp(fp)
                audio_b64 = base64.b64encode(fp.getvalue()).decode()
            except Exception as e:
                logger.error(f"TTS Error: {e}")
                audio_b64 = ""
            
        return transcript, translated_text, audio_b64

engine = TranslationEngine()

@asynccontextmanager
async def lifespan(app: FastAPI):
    engine.load_models()
    yield

app = FastAPI(lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.post("/process-speech")
async def process_speech(audio: UploadFile = File(...), src_lang: str = Form(...), tgt_lang: str = Form(...)):
    temp_filename = f"temp_{uuid.uuid4()}.webm"
    try:
        with open(temp_filename, "wb") as f:
            f.write(await audio.read())
        orig, trans, payload = engine.process(temp_filename, src_lang, tgt_lang)
        if not orig: 
            raise HTTPException(status_code=400, detail="No speech detected")
        return {"transcript": trans, "original_transcript": orig, "audio_payload": payload}
    finally:
        if os.path.exists(temp_filename): 
            os.remove(temp_filename)

# Run with Ngrok (Ensure Token is Set)
NGROK_TOKEN = "2tqvY63yg2d3sug91OhpaI6TQ4V_5jBCaPLCMh5smYSv15xGg" 
if NGROK_TOKEN:
    ngrok.set_auth_token(NGROK_TOKEN)

nest_asyncio.apply()
public_url = ngrok.connect(8000).public_url
print(f"\n🚀 BACKEND LIVE AT: {public_url}\n")
config = uvicorn.Config(app, host="0.0.0.0", port=8000)
server = uvicorn.Server(config)
await server.serve()