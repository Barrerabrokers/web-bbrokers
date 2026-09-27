#!/usr/bin/env node
'use strict';

// Uso: node gemini.js "Tu consulta"
// Configurar GEMINI_API_KEY y GEMINI_MODEL en la terminal.
async function main() {
  const prompt = process.argv.slice(2).join(' ').trim();
  if (!prompt || process.argv.includes('--help')) {
    console.log('Uso: node gemini.js "Tu consulta"\nVariables: GEMINI_API_KEY y GEMINI_MODEL (modelo disponible en tu cuenta).');
    process.exitCode = prompt ? 0 : 1;
    return;
  }
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL;
  if (!apiKey || apiKey === 'tu_clave_aqui') {
    throw new Error('Configurá GEMINI_API_KEY en tu terminal con una clave válida.');
  }
  if (!model) {
    throw new Error('Configurá GEMINI_MODEL con el identificador del modelo que querés usar.');
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const client = new GoogleGenerativeAI(apiKey);
  const result = await client.getGenerativeModel({ model }).generateContent(prompt);
  const answer = result.response.text();
  if (!answer) throw new Error('Gemini no devolvió texto.');
  console.log(answer);
}

main().catch((error) => {
  const key = process.env.GEMINI_API_KEY;
  const message = error instanceof Error ? error.message : 'Error inesperado.';
  console.error(key ? message.split(key).join('[CLAVE OCULTA]') : message);
  process.exitCode = 1;
});
