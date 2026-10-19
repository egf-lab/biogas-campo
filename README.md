# Aplicação de campo — poços de biogás

Página estática para o telemóvel do operador: posições dos poços e leituras
(CH₄, CO₂, O₂, H₂S, estado, nota) sem rede. Não fala com o EGF Lab — o
telemóvel nunca chega à rede da empresa. Os dados andam em ficheiros:

    EGF Lab ── pacote de campo (.json) ──▶ telemóvel ── Excel de leituras ──▶ EGF Lab
    Biogás › Poços / Mapa                                    Biogás › Importar leituras

## Aterro sem poços

Um aterro sem poços também tem pacote (lista vazia, mais as coordenadas da
instalação para o mapa abrir no sítio). A aplicação abre-o nas Posições: o
operador grava cada poço — número (1, 2, 3…), tipo e GPS — e o Excel das
posições entra em Biogás › Poços › Importar poços, que os cria. Pode ler os
poços novos no mesmo dia; nesse caso o escritório importa primeiro as
posições e só depois as leituras (a aplicação lembra-o junto ao Excel).

## Publicar

Automático. Cada commit do `main` que passa nos testes copia esta pasta para
um repositório público servido pelo GitHub Pages — o job `publicar-campo` em
`.github/workflows/deploy.yml`. Edita-se aqui; o outro repositório não se
mexe à mão.

Configuração, uma vez, no repositório do EGF Lab (Settings › Secrets and
variables › Actions):

- variável `FIELD_APP_REPO` — `organizacao/repositorio` de destino. Sem ela o
  job não corre;
- segredo `FIELD_APP_DEPLOY_KEY` — a chave privada de uma deploy key com
  escrita, posta só no repositório de destino.

E no EGF Lab, `FIELD_APP_URL` (config.py ou `.env`) com o endereço público:
é o que aparece, com o código QR, no "Pacote de campo".

Depois de mudar `index.html` não é preciso mais nada: os telemóveis apanham a
versão nova na abertura a seguir. Ao mudar bibliotecas, ícones ou o próprio
`sw.js`, subir `VERSION` em `sw.js`, e `APP_VERSION` em `index.html` para se
ver no ecrã qual está instalada.

O endereço é para ficar: o telemóvel guarda tudo agarrado a ele, e mudá-lo
obriga cada operador a recomeçar.

Para experimentar no computador: `python -m http.server` dentro desta pasta e
abrir `http://localhost:8000` (o service worker funciona em localhost).

## O que liga as duas pontas

- **Pacote de campo** — feito por `biogas_field_pack.py` (rota
  `/biogas/campo/pacote/<id>`). `format: "egflab-biogas-campo"`, `version: 1`.
  Mudar a forma do pacote é subir a versão nos dois lados.
- **Excel de leituras** — o cabeçalho é `READING_COLUMNS` em `index.html`, no
  formato longo que `biogas_import.py` reconhece sem mapear. A posição do GPS
  vai em colunas que a importação ignora de propósito, para um número mal
  escrito não criar um poço. `tests/test_field_app_export.py` lê o cabeçalho
  deste ficheiro e falha se a importação deixar de o reconhecer.
- **Excel de posições** — entra em Biogás › Poços › Importar poços, com
  "actualizar existentes".
