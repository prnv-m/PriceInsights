from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

import json

app = FastAPI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all methods
    allow_headers=["*"],  # Allows all headers
)

@app.get("/products/mobiles")
def get_products():
    with open("mobileresultswithimages.json") as f:
        data = json.load(f)
    return JSONResponse(content=data)
@app.get("/products/laptops")
def get_products():
    with open("results.json") as f:
        data = json.load(f)
    return JSONResponse(content=data)
