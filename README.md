# DisMulekadinhaCord

Aplicativo independente inspirado na interface do Discord, com servidores, canais, mensagens, voz e compartilhamento de tela.

**[Baixar para Windows](https://rampageplzz.github.io/DisMulekadinhaCord/)** · **[Abrir a aplicação](https://dismulekadinhacord.rampageplz.chatgpt.site)**

## Aplicativo Windows

O instalador **DisMulekadinhaCord-Setup-1.1.0.exe** é leve e usa o WebView2 compartilhado do Windows. O cliente instalado ocupa cerca de **0,88 MiB**, excluindo o runtime WebView2 compartilhado, cache e perfil. Não há medição comparativa de RAM/CPU com o Discord.

- Windows 10/11 atualizado, 64 bits, .NET Framework 4.8 e internet.
- Cliente nativo em C# / Windows Forms com WebView2 Evergreen.
- Atalhos no menu Iniciar e área de trabalho; desinstalador em Aplicativos do Windows.
- Instalação por usuário, sem necessidade de administrador.
- O bootstrapper oficial e assinado da Microsoft instala o WebView2 quando ausente; nesse caso há download adicional do runtime.
- O aplicativo e seu instalador ainda **não têm assinatura digital própria**.
- Perfil local em `%LOCALAPPDATA%/DisMulekadinhaCord/Profile`. A desinstalação preserva esse perfil e o runtime compartilhado.
- Atualizações do serviço web aparecem no aplicativo sem reinstalação. Atualizações do cliente nativo exigem novo instalador.

## Recursos implementados

- Cadastro e login, sessão HttpOnly, senhas com PBKDF2 e limite de tentativas.
- Servidores, convites, canais de texto/voz e lista de membros.
- Mensagens persistentes, busca, paginação, edição, exclusão, respostas, curtidas e fixação pelo dono.
- Conversas privadas entre dois usuários.
- Anexos de até 8 MB, acessíveis apenas por membros do canal.
- Chamadas WebRTC de até 8 participantes, microfone, áudio, câmera e transmissão de tela em perfis 1080p/60 FPS e 1440p/60 FPS.
- Botão de tela cheia em cada câmera ou transmissão, inclusive no cliente Windows.
- Compartilhamento de áudio da tela quando o navegador e a fonte escolhida permitem.
- Notificações do canal aberto, mediante permissão.

## Limites desta primeira versão

Não é uma reprodução de todas as funções do Discord. Não inclui Nitro, bots, integrações, chamadas em DMs, sistema de amizade/bloqueio, cargos avançados, recuperação de senha, moderação completa ou infraestrutura de mídia em escala.

As mensagens usam polling de 2 segundos. Áudio/vídeo usam malha P2P com STUN; redes com NAT/firewall restritivos podem exigir TURN. Não há TURN pago ou SFU provisionado. Até 8 participantes é um limite de software, não uma garantia de qualidade em qualquer conexão. A resolução e os 60 FPS dependem da fonte escolhida, do navegador, do computador e da banda disponível entre cada par de participantes.

O teste automatizado verifica sinalização entre participantes; áudio, captura da tela e qualidade de chamada **ainda precisam ser validados entre dois computadores reais**. A interface WebMCP é opcional e não foi validada em um contexto compatível.

## Desenvolvimento web

Node.js 22.13+.

```powershell
npm ci
npx wrangler d1 migrations apply DB --local --config wrangler.local.json
npm run dev
```

O banco de desenvolvimento fica em `.wrangler/state`. O banco publicado é separado; contas criadas localmente não são transferidas para produção.

```powershell
npx tsc --noEmit
npm run lint
npm test
npm run build
```

`npm test` requer o servidor local ativo e cria três contas isoladas por execução. Ele se recusa a rodar contra hosts de produção. Os componentes gerados de biblioteca, ainda não utilizados, ficam fora do lint da aplicação. O projeto usa React convencional, sem React Compiler.

## Compilar instalador

Em um Windows de 64 bits com .NET Framework 4.8:

```powershell
./desktop/build.ps1
./desktop/test-install.ps1
```

O script baixa WebView2 SDK 1.0.4191.47 e NSIS 3.12, verifica as assinaturas Microsoft e o checksum do NSIS, compila o cliente e gera o instalador com checksum SHA-256 em `desktop/out`.

O teste instala em uma pasta do projeto, verifica os arquivos/atalhos e desinstala. Ele não roda se detectar uma instalação existente.

## Hospedagem

A aplicação usa React/Vinext em Cloudflare Workers via Sites, D1 para registros e R2 para arquivos. `.openai/hosting.json` declara somente os vínculos lógicos. As migrações Drizzle em `drizzle/` são aplicadas na publicação; não se criam tabelas durante requisições.

O GitHub Pages hospeda apenas a página de download em `docs/`; não executa o backend. A URL do serviço está em `desktop/Program.cs`.

TURN opcional: configure `TURN_URL`, `TURN_USERNAME` e `TURN_PASSWORD` no ambiente de execução e publique novamente. Use credenciais de cliente com escopo/validade adequados; nunca use uma chave administrativa do provedor como senha TURN. As credenciais ICE precisam ser entregues aos participantes autenticados para estabelecer a conexão.

## Validação realizada

- Compilação da aplicação web e do executável Windows.
- TypeScript e lint da aplicação.
- 54 verificações HTTP: contas, sessões, convites, isolamento de acesso, mensagens, DMs, permissões, respostas, reações, fixação, exclusão, validação de entrada, origem das requisições e sinalização WebRTC.
- Instalação e desinstalação silenciosas com verificação de atalhos, registro e integridade do executável.
- `npm audit --omit=dev`: nenhuma vulnerabilidade reportada na validação. Existem avisos de auditoria em dependências de desenvolvimento do scaffold, que não foram eliminados com atualizações incompatíveis.

Projeto independente, sem afiliação com Discord Inc. As bibliotecas Microsoft mantêm sua própria licença, incluída no instalador.
