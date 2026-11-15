# NEXORA

Site estático para vender serviços digitais. Não usa banco de dados, API paga, assinatura nem checkout.

Serviços publicados: criação de sites, landing pages, cardápios digitais, artes para redes sociais e identidade visual. O cliente pede orçamento e o WhatsApp abre com a mensagem pronta. O pagamento é combinado fora do site.

## Antes de divulgar

1. Abra `js/config.js`.
2. Coloque seu WhatsApp só com números, DDI 55 e DDD. Exemplo: `5511987654321`.
3. Se quiser, preencha e-mail, Instagram e a URL final em `siteUrl`.
4. Ajuste preços e prazos no mesmo arquivo, ou faça isso na página Preços → **Editar tabela** → **Baixar config.js** e substitua `js/config.js`.

Salvar na página só altera o navegador em que você editou. Visitantes passam a ver a mudança quando o arquivo novo é publicado.

## Publicar de graça na Netlify

Repositório: https://github.com/xguilherme300-blip/nexora
Site já criado: https://nexora-digital-studio-6de74d.netlify.app

1. Na Netlify, abra o projeto e use **Link repository** / importar do GitHub.
2. Autorize o GitHub e selecione `xguilherme300-blip/nexora`, branch `main`.
3. Build command vazio. Publish directory: `.`
4. Cada push em `main` publica de novo. Plano gratuito, sem cartão.

## O que o visitante faz

Escolhe o serviço, abre **Contratar**, preenche nome, WhatsApp, e-mail e a descrição. O botão abre o WhatsApp. Se a janela for bloqueada, a página mostra o link para abrir manualmente. Nada fica gravado em servidor.
