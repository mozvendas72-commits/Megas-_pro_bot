// ⚡ MEGAS PRO ⚡ — Bot de vendas de megas (transferência MANUAL)
// Plataforma: Termux + Node.js + Baileys
// Pedidos feitos num grupo são publicados nesse mesmo grupo.
// A aprovação de pagamento NÃO conclui a compra. Use .enviar ID só depois da transferência manual.

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');

const NOME_BOT = '⚡ MEGAS PRO ⚡';
const DONO_NUMERO = '258834343047'; // Altere se este já não for o número do dono
const DONO_JID = `${DONO_NUMERO}@s.whatsapp.net`;
const PREFIXO = '.';

const PASTA_DADOS = path.join(__dirname, 'dados');
const ARQUIVO_DB = path.join(PASTA_DADOS, 'banco.json');
const PASTA_SESSAO = path.join(__dirname, 'auth_info_baileys');

fs.mkdirSync(PASTA_DADOS, { recursive: true });

const TABELA_PADRAO = [
  { categoria: 'DIÁRIO', pacote: '100MB', preco: 3 },
  { categoria: 'DIÁRIO', pacote: '150MB', preco: 4 },
  { categoria: 'DIÁRIO', pacote: '210MB', preco: 5 },
  { categoria: 'DIÁRIO', pacote: '260MB', preco: 6 },
  { categoria: 'DIÁRIO', pacote: '310MB', preco: 7 },
  { categoria: 'DIÁRIO', pacote: '350MB', preco: 8 },
  { categoria: 'DIÁRIO', pacote: '380MB', preco: 9 },
  { categoria: 'DIÁRIO', pacote: '410MB', preco: 10 },
  { categoria: 'DIÁRIO', pacote: '520MB', preco: 13 },
  { categoria: 'DIÁRIO', pacote: '610MB', preco: 15 },
  { categoria: 'DIÁRIO', pacote: '810MB', preco: 20 },
  { categoria: 'DIÁRIO', pacote: '1.30GB', preco: 25 },
  { categoria: 'DIÁRIO', pacote: '1.220GB', preco: 30 },
  { categoria: 'DIÁRIO', pacote: '1.540GB', preco: 38 },
  { categoria: 'DIÁRIO', pacote: '2.60GB', preco: 50 },
  { categoria: 'DIÁRIO', pacote: '2.440GB', preco: 60 },
  { categoria: 'DIÁRIO', pacote: '3.100GB', preco: 75 },
  { categoria: 'DIÁRIO', pacote: '4.150GB', preco: 100 },
  { categoria: 'DIÁRIO', pacote: '5.200GB', preco: 150 },
  { categoria: 'DIÁRIO', pacote: '3.4GB', preco: 95 },
  { categoria: 'DIÁRIO', pacote: '5.2GB', preco: 145 },
  { categoria: 'DIÁRIO', pacote: '7.1GB', preco: 185 },
  { categoria: 'DIÁRIO', pacote: '2.920GB', preco: 100 },
  { categoria: 'DIÁRIO', pacote: '7GB', preco: 190 },
  { categoria: 'SEMANAL', pacote: '10GB', preco: 230 },
  { categoria: 'SEMANAL', pacote: '10.7GB', preco: 285 },
  { categoria: 'SEMANAL', pacote: '14.300GB', preco: 379 },
  { categoria: 'SEMANAL', pacote: '10.715GB', preco: 290 },
  { categoria: 'MENSAL', pacote: '17.900GB-489', preco: 489 },
  { categoria: 'MENSAL', pacote: '17.900GB-470', preco: 470 },
  { categoria: 'MENSAL', pacote: '35.800GB', preco: 989 },
  { categoria: 'MENSAL', pacote: '53.600GB', preco: 1399 },
  { categoria: 'MENSAL', pacote: '71.500GB', preco: 1849 },
  { categoria: 'MENSAL', pacote: '89.400GB', preco: 2350 }
];

function bancoInicial() {
  return {
    tabela: TABELA_PADRAO,
    pagamentos: { mpesa: null, emola: null },
    compras: [],
    clientes: {},
    config: {
      manutencao: false,
      boasVindas: true,
      antilink: false,
      grupoFechado: false
    },
    contador: 1
  };
}

function carregarBanco() {
  try {
    if (!fs.existsSync(ARQUIVO_DB)) {
      fs.writeFileSync(ARQUIVO_DB, JSON.stringify(bancoInicial(), null, 2));
      return bancoInicial();
    }
    const lido = JSON.parse(fs.readFileSync(ARQUIVO_DB, 'utf8'));
    const padrao = bancoInicial();
    return {
      ...padrao,
      ...lido,
      config: { ...padrao.config, ...(lido.config || {}) },
      pagamentos: { ...padrao.pagamentos, ...(lido.pagamentos || {}) },
      tabela: Array.isArray(lido.tabela) && lido.tabela.length ? lido.tabela : TABELA_PADRAO,
      compras: Array.isArray(lido.compras) ? lido.compras : [],
      clientes: lido.clientes || {}
    };
  } catch (e) {
    console.error('Erro a ler banco.json:', e.message);
    const novo = bancoInicial();
    fs.writeFileSync(ARQUIVO_DB, JSON.stringify(novo, null, 2));
    return novo;
  }
}

let db = carregarBanco();
function guardar() {
  fs.writeFileSync(ARQUIVO_DB, JSON.stringify(db, null, 2));
}
function hora() {
  return new Date().toLocaleString('pt-MZ', { timeZone: 'Africa/Maputo' });
}
function soNumero(jid = '') {
  return String(jid).split('@')[0].split(':')[0].replace(/\D/g, '');
}
function jidDoParticipante(jid = '') {
  return String(jid).includes(':') ? String(jid).replace(/:\d+@/, '@') : jid;
}
function nomeSeguro(s = '') {
  return String(s).replace(/[\r\n]/g, ' ').trim().slice(0, 80);
}
function moeda(n) {
  return `${Number(n).toLocaleString('pt-MZ')} MT`;
}
function normalizarPacote(s = '') {
  return String(s).toLowerCase().replace(/\s+/g, '').replace(/,/g, '.');
}
function acharPacote(nome) {
  const alvo = normalizarPacote(nome);
  return db.tabela.find(x => normalizarPacote(x.pacote) === alvo);
}
function textoTabela() {
  const sec = ['DIÁRIO', 'SEMANAL', 'MENSAL'];
  let t = '╭━━━〔 ⚡ MEGAS PRO ⚡ 〕━━━╮\n';
  t += '┃ 🚀 *TABELA OFICIAL DE MEGAS* 🚀\n';
  t += '┃ 💎 Internet • Rapidez • Confiança\n';
  for (const categoria of sec) {
    t += `\n╭━━〔 ${categoria === 'DIÁRIO' ? '📅 🔥' : categoria === 'SEMANAL' ? '📆 💠' : '🗓️ 👑'} ${categoria} 〕━━╮\n`;
    const itens = db.tabela.filter(x => x.categoria === categoria);
    for (const item of itens) t += `┃ 📶 *${item.pacote}*  ➜  💰 *${moeda(item.preco)}*\n`;
    t += '╰━━━━━━━━━━━━━━━━━━╯\n';
  }
  t += '\n🛍️ Para comprar, escreve:\n*.compra PACOTE NÚMERO*\n';
  t += '📌 Exemplo: *.compra 100MB 841234567*\n';
  t += '\n💳 Escreve *Pagamento* para ver as formas de pagamento.\n';
  t += '╰━━━〔 ⚡ MEGAS PRO ⚡ 〕━━━╯';
  return t;
}
function textoPagamento() {
  let t = '╭━━━〔 💳 PAGAMENTOS 〕━━━╮\n';
  t += '┃ ⚡ *MEGAS PRO* ⚡\n\n';
  if (db.pagamentos.mpesa) {
    t += `📲 *M-Pesa*\n👤 ${db.pagamentos.mpesa.nome}\n☎️ ${db.pagamentos.mpesa.numero}\n\n`;
  } else t += '📲 *M-Pesa:* conta ainda não configurada.\n\n';
  if (db.pagamentos.emola) {
    t += `💠 *E-Mola*\n👤 ${db.pagamentos.emola.nome}\n☎️ ${db.pagamentos.emola.numero}\n\n`;
  } else t += '💠 *E-Mola:* conta ainda não configurada.\n\n';
  t += '📸 Depois de pagar, envia o comprovativo ao administrador.\n';
  t += '⚠️ O pedido só será concluído depois da confirmação do pagamento e da transferência dos megas.\n';
  t += '╰━━━━━━━━━━━━━━━━━━━━╯';
  return t;
}
function menu() {
  return `╭━━━〔 ⚡ MEGAS PRO ⚡ 〕━━━╮
┃ 🚀 *MENU PRINCIPAL*
┃
┃ 📶 *Tabela* — ver os preços
┃ 💳 *Pagamento* — ver contas
┃ 🛍️ *.compra PACOTE NÚMERO*
┃ 📦 *.minhascompras* — teus pedidos
┃ ⭐ *.pontos* — teus pontos
┃ ❌ *.cancelar ID* — cancelar pedido pendente
┃
┃ 👑 *ADMINISTRADOR*
┃ 🧾 *.fila* — pedidos pendentes
┃ ✅ *.aprovar ID* — confirmar pagamento
┃ 📤 *.enviar ID* — confirmar transferência manual
┃ 🚫 *.recusar ID* — recusar pedido
┃ 📊 *.relatorio* — resumo das vendas
┃ 👥 *.clientes* — lista de clientes
┃ 💳 *.addmpesa NÚMERO NOME*
┃ 💠 *.addemola NÚMERO NOME*
┃ ✏️ *.editarconfig PACOTE - PREÇO*
┃ ➖ *.removerconfig PACOTE*
┃ ➕ *.config PACOTE - PREÇO*
┃ 👋 *.boasvindas on/off*
┃ 🔒 *.fechar* / *.abrir*
┃ 🔗 *.antilink on/off*
┃ 👢 *.ban* / *.kick* / *.promover* / *.rebaixar*
┃ 🆔 *.id* — ID deste grupo
┃
┃ ℹ️ Transferência de megas é MANUAL.
╰━━━━━━━━━━━━━━━━━━━━━━━━╯`;
}

function acharCompra(id) {
  return db.compras.find(c => c.id.toLowerCase() === String(id || '').toLowerCase());
}
function gerarId() {
  const n = db.contador++;
  guardar();
  return `MP${Date.now().toString(36).toUpperCase()}${n.toString().padStart(3, '0')}`;
}
function atualizarCliente(jid, nome, compra, concluida = false) {
  const chave = soNumero(jid);
  if (!db.clientes[chave]) db.clientes[chave] = {
    jid, nome: nomeSeguro(nome || 'Cliente'), compras: 0, totalGasto: 0, pontos: 0
  };
  const cli = db.clientes[chave];
  cli.nome = nomeSeguro(nome || cli.nome);
  if (concluida && !compra.contabilizada) {
    cli.compras += 1;
    cli.totalGasto += Number(compra.preco);
    cli.pontos += Math.floor(Number(compra.preco) / 10);
    compra.contabilizada = true;
  }
  guardar();
}
function isDono(jid) {
  return soNumero(jid) === DONO_NUMERO;
}
async function ehAdmin(sock, grupo, remetente) {
  if (isDono(remetente)) return true;
  if (!grupo.endsWith('@g.us')) return false;
  try {
    const meta = await sock.groupMetadata(grupo);
    const participante = meta.participants.find(p => jidDoParticipante(p.id) === jidDoParticipante(remetente));
    return !!participante && (participante.admin === 'admin' || participante.admin === 'superadmin');
  } catch (_) { return false; }
}
async function responder(sock, chat, texto, quoted) {
  return sock.sendMessage(chat, { text: texto }, quoted ? { quoted } : {});
}
function mencionar(jid) {
  return jid ? `@${soNumero(jid)}` : 'cliente';
}
function ajudaCompra() {
  return '🛍️ *Como comprar megas*\n\nUsa este formato:\n*.compra PACOTE NÚMERO*\n\nExemplo: *.compra 100MB 841234567*\n\n📶 Vê os pacotes disponíveis escrevendo *Tabela*.';
}

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState(PASTA_SESSAO);
  let versao;
  try { versao = (await fetchLatestBaileysVersion()).version; } catch (_) { versao = undefined; }
  let pediuPareamento = false;

  const sock = makeWASocket({
    auth: state,
    version: versao,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['MEGAS PRO', 'Chrome', '1.0.0'],
    markOnlineOnConnect: true,
    syncFullHistory: false
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr && !state.creds.registered && !pediuPareamento) {
      pediuPareamento = true;
      try {
        const codigo = await sock.requestPairingCode(DONO_NUMERO);
        console.log('\n╭━━━〔 ⚡ MEGAS PRO ⚡ 〕━━━╮');
        console.log('📲 Código de pareamento do WhatsApp: ' + codigo);
        console.log('No WhatsApp: Dispositivos ligados > Ligar dispositivo > Ligar com número de telefone.');
        console.log('╰━━━━━━━━━━━━━━━━━━━━╯\n');
      } catch (e) {
        console.log('Não foi possível gerar código de pareamento: ' + e.message);
        console.log('Se aparecer QR no terminal, podes usar o QR como alternativa.');
      }
    }
    if (connection === 'open') {
      console.log(`\n✅ ${NOME_BOT} está ligado!`);
      console.log('⚠️ As transferências de megas estão DESATIVADAS: serão manuais.');
      if (!state.creds.registered) {
        console.log('Se o WhatsApp pedir pareamento, reinicia e usa o código de pareamento configurado no teu fluxo.');
      }
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode;
      const desconectado = code === DisconnectReason.loggedOut;
      console.log('Ligação fechada.', desconectado ? 'Sessão terminada; apaga auth_info_baileys e liga novamente.' : 'A tentar ligar de novo...');
      if (!desconectado) setTimeout(iniciar, 3000);
    }
  });

  sock.ev.on('group-participants.update', async (ev) => {
    if (!db.config.boasVindas || ev.action !== 'add') return;
    for (const p of ev.participants) {
      const jid = jidDoParticipante(p);
      const mensagem = `╭━━━〔 🎉 BEM-VINDO(A)! 〕━━━╮\n┃ ⚡ *MEGAS PRO* ⚡\n┃ 👋 Bem-vindo(a), @${soNumero(jid)}!\n┃ 📶 Temos pacotes de megas disponíveis.\n┃ Escreve *Tabela* para ver os preços.\n┃ Escreve *Pagamento* para ver as contas.\n╰━━━━━━━━━━━━━━━━━━━━╯`;
      try { await sock.sendMessage(ev.id, { text: mensagem, mentions: [jid] }); } catch (e) { console.log('Falha na boas-vindas:', e.message); }
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;
        const chat = msg.key.remoteJid;
        if (!chat || chat === 'status@broadcast') continue;
        const remetente = jidDoParticipante(msg.key.participant || chat);
        const isGrupo = chat.endsWith('@g.us');
        const nome = msg.pushName || 'Cliente';
        const textoOriginal = msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption || '';
        const texto = String(textoOriginal).trim();
        if (!texto) continue;
        const lower = texto.toLowerCase();
        const args = texto.split(/\s+/);
        const comando = args[0].toLowerCase();
        const admin = await ehAdmin(sock, chat, remetente);

        if (db.config.manutencao && !isDono(remetente) && !['tabela', 'pagamento'].includes(lower)) {
          await responder(sock, chat, '🛠️ O bot está em manutenção. Tenta novamente mais tarde.', msg);
          continue;
        }

        // Comandos públicos sem ponto
        if (lower === 'tabela' || lower === '📶 tabela') {
          await responder(sock, chat, textoTabela(), msg);
          continue;
        }
        if (lower === 'pagamento' || lower === 'pagamentos') {
          await responder(sock, chat, textoPagamento(), msg);
          continue;
        }
        if (['menu', '.menu', 'ajuda', '.ajuda', '.comandos'].includes(lower)) {
          await responder(sock, chat, menu(), msg);
          continue;
        }
        if (lower === 'oi' || lower === 'olá' || lower === 'ola' || lower === 'bom dia' || lower === 'boa tarde' || lower === 'boa noite') {
          await responder(sock, chat, `✨ Olá, ${nomeSeguro(nome)}! Bem-vindo(a) ao *${NOME_BOT}*!\n\n📶 Escreve *Tabela* para ver os pacotes.\n💳 Escreve *Pagamento* para ver as contas.\n🛍️ Para comprar: *.compra PACOTE NÚMERO*`, msg);
          continue;
        }

        // Compra: .compra PACOTE NÚMERO (o pedido é publicado no grupo de origem)
        if (comando === '.compra' || comando === '.comprar') {
          if (args.length < 3) {
            await responder(sock, chat, ajudaCompra(), msg);
            continue;
          }
          const pacoteTexto = args.slice(1, -1).join(' ');
          const numeroDestino = args[args.length - 1].replace(/\D/g, '');
          const pacote = acharPacote(pacoteTexto);
          if (!pacote) {
            await responder(sock, chat, `❌ Não encontrei o pacote *${pacoteTexto}*.\n\nEscreve *Tabela* e copia o nome do pacote exatamente como aparece.`, msg);
            continue;
          }
          if (numeroDestino.length < 9 || numeroDestino.length > 15) {
            await responder(sock, chat, '❌ Número de destino inválido. Escreve o número com indicativo do país, se necessário.', msg);
            continue;
          }
          const id = gerarId();
          const compra = {
            id, jidCliente: remetente, nomeCliente: nomeSeguro(nome), grupo: isGrupo ? chat : null,
            pacote: pacote.pacote, categoria: pacote.categoria, numeroDestino, preco: pacote.preco,
            estado: 'AGUARDANDO_PAGAMENTO', criadoEm: hora(), contabilizada: false
          };
          db.compras.push(compra);
          atualizarCliente(remetente, nome, compra, false);
          guardar();

          const pedido = `╭━━━〔 🛍️ NOVO PEDIDO 〕━━━╮
┃ ⚡ *MEGAS PRO* ⚡
┃ 🆔 *Pedido:* ${id}
┃ 👤 *Cliente:* ${nomeSeguro(nome)}
┃ 📦 *Pacote:* ${pacote.pacote} (${pacote.categoria})
┃ 📲 *Destino:* ${numeroDestino}
┃ 💰 *Valor:* ${moeda(pacote.preco)}
┃ ⏳ *Estado:* AGUARDANDO PAGAMENTO
┃ 🕒 *Data:* ${hora()}
╰━━━━━━━━━━━━━━━━━━━━╯
💳 Cliente: consulta *Pagamento* e envia o comprovativo.
👑 Admin: usa *.aprovar ${id}* depois de confirmar o pagamento.
📤 Depois da transferência manual, usa *.enviar ${id}*.`;
          if (isGrupo) {
            await responder(sock, chat, `✅ Pedido registado, ${nomeSeguro(nome)}!\n🆔 ID: *${id}*\n📦 ${pacote.pacote} por *${moeda(pacote.preco)}*.\n💳 Consulta *Pagamento* e envia o comprovativo.\n\n📢 O pedido foi publicado para o administrador acompanhar.`, msg);
            await sock.sendMessage(chat, { text: pedido, mentions: [remetente] });
          } else {
            await responder(sock, chat, `✅ Pedido registado!\n🆔 *${id}*\n📦 *${pacote.pacote}* — ${moeda(pacote.preco)}\n\n${textoPagamento()}\n\n⚠️ O pedido foi guardado, mas não tenho o ID do grupo de vendas. Faz o pedido dentro do grupo para publicar lá automaticamente.`, msg);
          }
          continue;
        }

        if (comando === '.minhascompras') {
          const minhas = db.compras.filter(c => soNumero(c.jidCliente) === soNumero(remetente)).slice(-10).reverse();
          if (!minhas.length) {
            await responder(sock, chat, '📦 Ainda não tens pedidos registados. Usa *.compra PACOTE NÚMERO*.', msg);
          } else {
            await responder(sock, chat, '╭━━〔 📦 OS TEUS PEDIDOS 〕━━╮\n' + minhas.map(c => `🆔 ${c.id}\n📶 ${c.pacote} — ${moeda(c.preco)}\n📌 Estado: ${c.estado}`).join('\n\n') + '\n╰━━━━━━━━━━━━━━━━━━━━╯', msg);
          }
          continue;
        }
        if (comando === '.pontos') {
          const c = db.clientes[soNumero(remetente)] || { compras: 0, totalGasto: 0, pontos: 0 };
          await responder(sock, chat, `⭐ *TEU RESUMO — MEGAS PRO* ⭐\n🛍️ Compras concluídas: ${c.compras}\n💰 Total gasto: ${moeda(c.totalGasto)}\n🏆 Pontos: ${c.pontos}\n\n📌 Só compras concluídas contam para os pontos.`, msg);
          continue;
        }
        if (comando === '.cancelar') {
          const id = args[1];
          const c = acharCompra(id);
          if (!c) { await responder(sock, chat, '❌ Não encontrei esse ID de pedido.', msg); continue; }
          if (soNumero(c.jidCliente) !== soNumero(remetente) && !isDono(remetente)) {
            await responder(sock, chat, '⛔ Só o dono do pedido ou o administrador pode cancelar.', msg); continue;
          }
          if (c.estado !== 'AGUARDANDO_PAGAMENTO') {
            await responder(sock, chat, '⚠️ Só é possível cancelar um pedido que ainda aguarda pagamento.', msg); continue;
          }
          c.estado = 'CANCELADA'; c.atualizadoEm = hora(); guardar();
          await responder(sock, chat, `❌ Pedido *${c.id}* cancelado.`, msg);
          if (c.grupo && c.grupo !== chat) await sock.sendMessage(c.grupo, { text: `❌ Pedido *${c.id}* cancelado pelo cliente/administrador.` });
          continue;
        }

        // Daqui para baixo, comandos administrativos
        if (comando.startsWith('.') && !admin && !isDono(remetente)) {
          const comandosAdmin = ['.aprovar','.enviar','.recusar','.fila','.relatorio','.clientes','.addmpesa','.addemola','.config','.editarconfig','.removerconfig','.boasvindas','.antilink','.abrir','.fechar','.ban','.kick','.add','.promover','.rebaixar','.manutencao','.id'];
          if (comandosAdmin.includes(comando)) {
            await responder(sock, chat, '⛔ Este comando é apenas para administradores do grupo ou dono do bot.', msg);
            continue;
          }
        }

        if (comando === '.aprovar') {
          if (!admin && !isDono(remetente)) { await responder(sock, chat, '⛔ Só admin pode confirmar pagamentos.', msg); continue; }
          const c = acharCompra(args[1]);
          if (!c) { await responder(sock, chat, '❌ ID não encontrado. Usa *.fila* para ver os pedidos.', msg); continue; }
          if (['CONCLUIDA','CANCELADA','RECUSADA'].includes(c.estado)) { await responder(sock, chat, `⚠️ O pedido está ${c.estado}.`, msg); continue; }
          c.estado = 'PAGAMENTO_CONFIRMADO'; c.pagamentoConfirmadoEm = hora(); guardar();
          await responder(sock, chat, `✅ Pagamento confirmado para *${c.id}*.\n📦 Pacote: ${c.pacote}\n📲 Destino: ${c.numeroDestino}\n\n⚠️ Agora faz a transferência MANUAL. Quando terminar, usa *.enviar ${c.id}*.`, msg);
          if (c.jidCliente) await sock.sendMessage(c.jidCliente, { text: `💳 *Pagamento confirmado!*\n🆔 Pedido: ${c.id}\n📦 Pacote: ${c.pacote}\n⏳ O administrador está a preparar a transferência. Receberás confirmação quando for concluída.` });
          continue;
        }
        if (comando === '.enviar') {
          if (!admin && !isDono(remetente)) { await responder(sock, chat, '⛔ Só admin pode confirmar a entrega.', msg); continue; }
          const c = acharCompra(args[1]);
          if (!c) { await responder(sock, chat, '❌ ID não encontrado.', msg); continue; }
          if (c.estado === 'CONCLUIDA') { await responder(sock, chat, '⚠️ Este pedido já foi concluído.', msg); continue; }
          if (c.estado !== 'PAGAMENTO_CONFIRMADO') {
            await responder(sock, chat, '⚠️ Primeiro confirma o pagamento com *.aprovar ID*. Só usa *.enviar ID* depois de fazeres a transferência manual dos megas.', msg);
            continue;
          }
          c.estado = 'CONCLUIDA'; c.concluidoEm = hora();
          atualizarCliente(c.jidCliente, c.nomeCliente, c, true);
          guardar();
          await responder(sock, chat, `🎉 *PEDIDO CONCLUÍDO!*\n🆔 ${c.id}\n📦 ${c.pacote}\n📲 Destino: ${c.numeroDestino}\n💰 ${moeda(c.preco)}\n⭐ Pontos do cliente atualizados.\n\n⚠️ Registo marcado como entregue manualmente pelo administrador.`, msg);
          if (c.jidCliente) await sock.sendMessage(c.jidCliente, { text: `🎉✨ *MEGAS ENTREGUES!*\n\n⚡ *MEGAS PRO* ⚡\n🆔 Pedido: ${c.id}\n📦 Pacote: ${c.pacote}\n📲 Número: ${c.numeroDestino}\n\nObrigado pela compra! 💚🚀` });
          if (c.grupo && c.grupo !== chat) await sock.sendMessage(c.grupo, { text: `🎉 Pedido *${c.id}* concluído! 📦 ${c.pacote} entregue manualmente. Obrigado por comprar no ⚡ MEGAS PRO ⚡!` });
          continue;
        }
        if (comando === '.recusar') {
          if (!admin && !isDono(remetente)) { await responder(sock, chat, '⛔ Só admin pode recusar pedidos.', msg); continue; }
          const c = acharCompra(args[1]);
          if (!c) { await responder(sock, chat, '❌ ID não encontrado.', msg); continue; }
          if (c.estado === 'CONCLUIDA') { await responder(sock, chat, '⚠️ Uma compra concluída não pode ser recusada.', msg); continue; }
          c.estado = 'RECUSADA'; c.atualizadoEm = hora(); guardar();
          await responder(sock, chat, `🚫 Pedido *${c.id}* marcado como recusado.`, msg);
          if (c.jidCliente) await sock.sendMessage(c.jidCliente, { text: `🚫 O pedido ${c.id} foi recusado. Contacta o administrador se achares que houve um erro.` });
          continue;
        }
        if (comando === '.fila') {
          if (!admin && !isDono(remetente)) { await responder(sock, chat, '⛔ Só admin pode consultar a fila.', msg); continue; }
          const pendentes = db.compras.filter(c => !['CONCLUIDA','CANCELADA','RECUSADA'].includes(c.estado)).slice(-25).reverse();
          await responder(sock, chat, pendentes.length ? '╭━━〔 🧾 FILA DE PEDIDOS 〕━━╮\n' + pendentes.map(c => `🆔 *${c.id}*\n👤 ${c.nomeCliente}\n📦 ${c.pacote} — ${moeda(c.preco)}\n📲 ${c.numeroDestino}\n📌 ${c.estado}`).join('\n\n') + '\n╰━━━━━━━━━━━━━━━━━━━━╯' : '✅ Não há pedidos pendentes.', msg);
          continue;
        }
        if (comando === '.relatorio') {
          if (!admin && !isDono(remetente)) { await responder(sock, chat, '⛔ Só admin pode ver o relatório.', msg); continue; }
          const concluidas = db.compras.filter(c => c.estado === 'CONCLUIDA');
          const pendentes = db.compras.filter(c => !['CONCLUIDA','CANCELADA','RECUSADA'].includes(c.estado));
          const total = concluidas.reduce((s,c) => s + Number(c.preco), 0);
          await responder(sock, chat, `╭━━〔 📊 RELATÓRIO 〕━━╮\n🛍️ Pedidos totais: ${db.compras.length}\n✅ Concluídos: ${concluidas.length}\n⏳ Pendentes: ${pendentes.length}\n💰 Vendas concluídas: ${moeda(total)}\n👥 Clientes registados: ${Object.keys(db.clientes).length}\n╰━━━━━━━━━━━━━━━━━━━━╯`, msg);
          continue;
        }
        if (comando === '.clientes') {
          if (!admin && !isDono(remetente)) { await responder(sock, chat, '⛔ Só admin pode ver os clientes.', msg); continue; }
          const lista = Object.entries(db.clientes).slice(-30).reverse();
          await responder(sock, chat, lista.length ? '╭━━〔 👥 CLIENTES 〕━━╮\n' + lista.map(([n,c]) => `👤 ${c.nome}\n📲 ${n}\n🛍️ ${c.compras} compras • ⭐ ${c.pontos} pontos\n💰 ${moeda(c.totalGasto)}`).join('\n\n') + '\n╰━━━━━━━━━━━━━━━━━━━━╯' : 'Ainda não há clientes registados.', msg);
          continue;
        }
        if (comando === '.addmpesa' || comando === '.addemola') {
          if (!isDono(remetente)) { await responder(sock, chat, '⛔ Só o dono do bot pode configurar as contas de pagamento.', msg); continue; }
          const numero = args[1];
          const nomeConta = args.slice(2).join(' ');
          if (!numero || !nomeConta) { await responder(sock, chat, `Uso: ${comando} NÚMERO NOME`, msg); continue; }
          const chave = comando === '.addmpesa' ? 'mpesa' : 'emola';
          db.pagamentos[chave] = { numero: numero.replace(/\D/g, ''), nome: nomeSeguro(nomeConta) };
          guardar();
          await responder(sock, chat, `✅ Conta ${chave === 'mpesa' ? 'M-Pesa' : 'E-Mola'} configurada.\nEscreve *Pagamento* para verificar.`, msg);
          continue;
        }
        if (comando === '.contas') {
          if (!isDono(remetente) && !admin) { await responder(sock, chat, '⛔ Sem autorização.', msg); continue; }
          await responder(sock, chat, textoPagamento(), msg);
          continue;
        }
        if (comando === '.config' || comando === '.editarconfig') {
          if (!isDono(remetente)) { await responder(sock, chat, '⛔ Só o dono pode alterar a tabela.', msg); continue; }
          const resto = texto.replace(/^\.?(config|editarconfig)\s+/i, '');
          const partes = resto.split(/\s*-\s*/);
          if (partes.length < 2) { await responder(sock, chat, `Uso: ${comando} PACOTE - PREÇO\nExemplo: ${comando} 100MB - 3`, msg); continue; }
          const pacoteNome = partes[0].trim();
          const preco = Number(partes[1].replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!pacoteNome || !Number.isFinite(preco) || preco <= 0) { await responder(sock, chat, '❌ Pacote ou preço inválido.', msg); continue; }
          const existente = acharPacote(pacoteNome);
          if (existente) { existente.preco = preco; }
          else db.tabela.push({ categoria: 'DIÁRIO', pacote: pacoteNome, preco });
          guardar();
          await responder(sock, chat, `✅ Tabela atualizada!\n📶 ${pacoteNome} = ${moeda(preco)}\n\nEscreve *Tabela* para conferir.`, msg);
          continue;
        }
        if (comando === '.removerconfig') {
          if (!isDono(remetente)) { await responder(sock, chat, '⛔ Só o dono pode alterar a tabela.', msg); continue; }
          const pacoteNome = args.slice(1).join(' ');
          const antes = db.tabela.length;
          db.tabela = db.tabela.filter(x => normalizarPacote(x.pacote) !== normalizarPacote(pacoteNome));
          guardar();
          await responder(sock, chat, antes === db.tabela.length ? '❌ Pacote não encontrado.' : `🗑️ Pacote *${pacoteNome}* removido da tabela.`, msg);
          continue;
        }
        if (comando === '.boasvindas') {
          if (!isDono(remetente) && !admin) { await responder(sock, chat, '⛔ Sem autorização.', msg); continue; }
          const valor = args[1]?.toLowerCase();
          if (!['on','off'].includes(valor)) { await responder(sock, chat, 'Uso: .boasvindas on ou .boasvindas off', msg); continue; }
          db.config.boasVindas = valor === 'on'; guardar();
          await responder(sock, chat, `👋 Boas-vindas ${valor === 'on' ? 'ativadas' : 'desativadas'}.`, msg);
          continue;
        }
        if (comando === '.manutencao') {
          if (!isDono(remetente)) { await responder(sock, chat, '⛔ Só o dono pode ativar manutenção.', msg); continue; }
          const valor = args[1]?.toLowerCase();
          if (!['on','off'].includes(valor)) { await responder(sock, chat, 'Uso: .manutencao on/off', msg); continue; }
          db.config.manutencao = valor === 'on'; guardar();
          await responder(sock, chat, `🛠️ Manutenção ${valor === 'on' ? 'ativada' : 'desativada'}.`, msg);
          continue;
        }
        if (comando === '.abrir' || comando === '.fechar') {
          if (!isGrupo || (!admin && !isDono(remetente))) { await responder(sock, chat, '⛔ Este comando precisa de administrador do grupo.', msg); continue; }
          try {
            await sock.groupSettingUpdate(chat, comando === '.fechar' ? 'announcement' : 'not_announcement');
            await responder(sock, chat, comando === '.fechar' ? '🔒 Grupo fechado: só admins podem enviar mensagens.' : '🔓 Grupo aberto: todos podem enviar mensagens.', msg);
          } catch (e) { await responder(sock, chat, `❌ Não consegui alterar o grupo. Dá ao bot permissões de administrador.\n${e.message}`, msg); }
          continue;
        }
        if (comando === '.id') {
          await responder(sock, chat, `🆔 ID deste chat:\n${chat}`, msg);
          continue;
        }
        if (['.ban','.kick','.add','.promover','.rebaixar'].includes(comando)) {
          if (!isGrupo || (!admin && !isDono(remetente))) { await responder(sock, chat, '⛔ Este comando só funciona em grupos e requer administrador.', msg); continue; }
          const citado = msg.message.extendedTextMessage?.contextInfo?.participant;
          const alvoTexto = args[1] || '';
          const numeroAlvo = alvoTexto.replace(/\D/g, '');
          const alvo = citado ? jidDoParticipante(citado) : (numeroAlvo ? `${numeroAlvo}@s.whatsapp.net` : null);
          if (!alvo) { await responder(sock, chat, `Uso: ${comando} @membro (marca a pessoa ou responde à mensagem dela).`, msg); continue; }
          try {
            const acao = comando === '.ban' || comando === '.kick' ? 'remove' :
              comando === '.add' ? 'add' :
              comando === '.promover' ? 'promote' : 'demote';
            await sock.groupParticipantsUpdate(chat, [alvo], acao);
            await responder(sock, chat, `✅ Ação *${comando}* executada para @${soNumero(alvo)}.`, msg);
          } catch (e) {
            await responder(sock, chat, `❌ Não consegui executar ${comando}. Verifica se o bot é administrador e se o alvo é válido.`, msg);
          }
          continue;
        }
        if (comando === '.antilink') {
          if (!isDono(remetente) && !admin) { await responder(sock, chat, '⛔ Sem autorização.', msg); continue; }
          const valor = args[1]?.toLowerCase();
          if (!['on','off'].includes(valor)) { await responder(sock, chat, 'Uso: .antilink on/off', msg); continue; }
          db.config.antilink = valor === 'on'; guardar();
          await responder(sock, chat, `🔗 Antilink ${valor === 'on' ? 'ativado' : 'desativado'}.`, msg);
          continue;
        }

        // Antilink simples: apaga mensagens de links enviados por não-admins se o bot tiver permissão.
        if (isGrupo && db.config.antilink && /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(texto) && !admin && !isDono(remetente)) {
          try {
            await sock.sendMessage(chat, { delete: msg.key });
            await responder(sock, chat, '🚫 Links não são permitidos neste grupo.', null);
          } catch (_) {}
          continue;
        }

      } catch (e) {
        console.error('Erro a processar mensagem:', e.stack || e.message || e);
      }
    }
  });

  return sock;
}

iniciar().catch(err => {
  console.error('Erro ao iniciar MEGAS PRO:', err);
  process.exit(1);
});
