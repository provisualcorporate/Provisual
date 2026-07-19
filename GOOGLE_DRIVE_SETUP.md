# Guia de Configuração: Google Drive + ProVisual

Este guia explica como conectar o seu Google Drive ao ProVisual para buscar arquivos automaticamente.

## 1. Configuração no Google Cloud Console

1.  Aceda ao [Google Cloud Console](https://console.cloud.google.com/).
2.  Crie um novo projeto chamado **"ProVisual-Drive"**.
3.  No menu lateral, vá a **APIs e Serviços > Biblioteca**.
4.  Pesquise por **"Google Drive API"** e clique em **Ativar**.
5.  Vá a **APIs e Serviços > Credenciais**.
6.  Clique em **Criar Credenciais > Conta de Serviço**.
7.  Dê um nome (ex: `drive-sync`) e clique em **Criar e Continuar**.
8.  Na lista de Contas de Serviço, clique no email da conta que criou.
9.  Vá ao separador **Chaves > Adicionar Chave > Criar nova chave (JSON)**.
10. O download de um arquivo `.json` será feito. **Guarde este arquivo em segurança**, ele é a sua chave de acesso.

## 2. Dar Permissão às Pastas do Drive

Para que o sistema consiga ler os seus arquivos, você precisa partilhar a pasta do Google Drive com o email da Conta de Serviço:

1.  Abra o seu Google Drive.
2.  Clique com o botão direito na pasta que deseja sincronizar.
3.  Clique em **Partilhar**.
4.  Cole o email da Conta de Serviço (ex: `drive-sync@projeto.iam.gserviceaccount.com`).
5.  Dê permissão de **Leitor** e salve.

## 3. Implementação Técnica (Resumo)

Para buscar os dados no código, usaremos a biblioteca `googleapis`. 

### Exemplo de código para buscar arquivos:

```javascript
const { google } = require('googleapis');
const keys = require('./sua-chave-baixada.json');

const auth = new google.auth.JWT(
  keys.client_email,
  null,
  keys.private_key,
  ['https://www.googleapis.com/auth/drive.readonly']
);

const drive = google.drive({ version: 'v3', auth });

async function listFiles(folderId) {
  const res = await drive.files.list({
    q: `'${folderId}' in parents`,
    fields: 'files(id, name, mimeType, webViewLink, size)',
  });
  return res.data.files;
}
```

## 4. Produção (Vercel) — resolver "Credenciais não configuradas"

Os ficheiros `google-oauth.json` e `provisual-corporate-*.json` **não vão para o Git** (estão no `.gitignore`). Na Vercel o servidor não os encontra, por isso aparece o erro.

### Opção A — Recomendada (uma vez no Mac)

Com os JSON na raiz do projeto:

```bash
node scripts/push-google-credentials.mjs
```

Isto grava as credenciais na tabela `settings` do Supabase. O backend em produção lê-as automaticamente após o próximo deploy.

### Opção B — Variáveis na Vercel

No painel Vercel → Settings → Environment Variables:

| Variável | Valor |
|----------|--------|
| `GOOGLE_CLIENT_ID` | `client_id` do `google-oauth.json` |
| `GOOGLE_CLIENT_SECRET` | `client_secret` do `google-oauth.json` |
| `GOOGLE_KEYS` | Conteúdo completo do JSON da conta de serviço (uma linha) |

### Conta pessoal OAuth (opcional)

1. No [Google Cloud Console](https://console.cloud.google.com/) → Credenciais → OAuth, adicione o redirect URI de produção:  
   `https://SEU-DOMINIO.vercel.app/api/drive/auth/callback`
2. No painel admin → separador **Google Drive** → **Conectar Google Drive** (login `provisualcorporate@gmail.com`).

Sem OAuth ligado, o sistema usa a **conta de serviço** (`provisual-sync@provisual-corporate.iam.gserviceaccount.com`) — desde que as pastas do Drive estejam partilhadas com esse email.

## 5. Próximos Passos
Se desejar sincronização de uma pasta específica:
1. Partilhe a pasta no Drive com o email da conta de serviço (Leitor ou Editor).
2. Indique o ID da pasta (código no URL do Google Drive).
