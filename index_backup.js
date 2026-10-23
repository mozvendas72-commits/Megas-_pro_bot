// ================================================
// ⚡ MEGAS PRO ⚡
// Bot de vendas WhatsApp para Termux
// ================================================

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  downloadMediaMessage
} = require("@whiskeysockets/baileys");

const pino = require("pino");
const qrcode = require("qrcode-terminal");
const fs = require("fs");
const path = require("path");

// ---------- CONFIGURAÇÃO ----------
const NOME_BOT = "⚡ MEGAS PRO ⚡";
const PASTA = __dirname;
const ARQUIVO = path.join(PASTA, "dados.json");
const SESSAO = path.join(PASTA, "auth_info_baileys");

// Coloca aqui o número do dono, com indicativo do país.
// Exemplo Moçambique: 25884XXXXXXX
const DONO_NUMERO = "258844416510";

// O webhook será configurado na próxima etapa com MacroDroid.
const WEBHOOK_PADRAO = "";

const PRECOS = {
  "100MB": 3,
  "155MB": 4,
  "210MB": 5,
  "265MB": 6,
  "310MB": 7,
  "355MB": 8,
  "385MB": 9,
  "410MB": 10,
  "530MB": 13,
  "620MB": 15,
  "820MB": 20,
  "1.10GB": 25,
  "1.300GB": 30,
  "1.650GB": 38,
  "2.20GB": 50,
  "2.500GB": 60,
  "3.200GB": 75,
  "4.300GB": 100,
  "5.300GB": 150,
  "10GB": 230,
  "3.4GB semanal": 95,
  "5.2GB semanal": 145,
  "7.1GB semanal": 185,
  "10.7GB semanal": 285,
  "14.3GB semanal": 379,
  "3GB mensal": 100,
  "7GB mensal": 190,
  "11GB mensal": 290,
  "18GB mensal": 489,
  "36GB mensal": 989,
  "54GB mensal": 1399,
  "72GB mensal": 1849,
  "90GB mensal": 2350
};

// ---------- BANCO DE DADOS ----------
function bancoInicial() {
  return {
    config: PRECOS,
    dono: DONO_NUMERO,
    mpesa: { numero: "", nome: "" },
    emola: { numero: "", nome: "" },
    webhook: WEBHOOK_PADRAO,
    webhooksGrupos: {},
    grupos: {},
    clientes: {},
    compras: [],
    fila: [],
    alugueis: [],
    precosBot: { "1": 50, "7": 150, "30": 500 },
    nano: {},
    estatisticas: {
      vendas: 0,
      faturamento: 0,
      transferencias: 0
    },
    stock: {},
    protecoes: {
      antifoto: false,
      antiaudio: false,
      antivideo: false,
      antistatus: false,
      antilink: false,
      detector: false
    },
    comprasLigadas: true,
    aluguelLigado: true,
    boasVindas: true,
    botNome: NOME_BOT
  };
}

function carregarBanco() {
  try {
    if (fs.existsSync(ARQUIVO)) {
      const existente = JSON.parse(fs.readFileSync(ARQUIVO, "utf8"));
      return {
        ...bancoInicial(),
        ...existente,
        config: { ...PRECOS, ...(existente.config || {}) },
        protecoes: {
          ...bancoInicial().protecoes,
          ...(existente.protecoes || {})
        }
      };
    }
  } catch (e) {
    console.error("Erro ao ler dados.json:", e.message);
  }
  return bancoInicial();
}

let dados = carregarBanco();

function guardar() {
  try {
    fs.writeFileSync(ARQUIVO, JSON.stringify(dados, null, 2));
  } catch (e) {
    console.error("Erro ao guardar banco:", e.message);
  }
}

function numeroLimpo(texto = "") {
  return String(texto).replace(/\D/g, "");
}

function chaveGrupo(jid) {
  return dados.grupos[jid] || (dados.grupos[jid] = {
    aberto: true,
    horarioAbrir: "",
    horarioFechar: "",
    boasVindas: true,
    protecoes: {},
    webhook: "",
    nano: {}
  });
}

function textoPacote(pacote) {
  const chave = Object.keys(dados.config).find(
    p => p.toLowerCase() === String(pacote).trim().toLowerCase()
  );
  return chave || null;
}

function formatarTabela() {
  const entradas = Object.entries(dados.config);
  const diarios = entradas.filter(([p]) => !/semanal|mensal/i.test(p));
  const semanais = entradas.filter(([p]) => /semanal/i.test(p));
  const mensais = entradas.filter(([p]) => /mensal/i.test(p));

  const listar = lista => lista.length
    ? lista.map(([p, v]) => `• ${p}: *${v} MT*`).join("\n")
    : "Ainda não há pacotes.";

  return `╭━━━〔 ${NOME_BOT} 〕━━━╮
📶 *TABELA DE MEGAS*

📅 *DIÁRIOS*
${listar(diarios)}

📆 *SEMANAIS*
${listar(semanais)}

🗓️ *MENSAIS*
${listar(mensais)}

Para fazer pedido, envia:
*.compra PACOTE NÚMERO*
Exemplo: *.compra 410MB 258844416510*

╰━━━━━━━━━━━━━━━━━━╯`;
}

function menuTexto() {
  return `╭━━━〔 ${NOME_BOT} 〕━━━╮
⚡ *MENU PRINCIPAL*

📶 Tabela
💳 Pagamento
🛒 .compra PACOTE NÚMERO
📦 .compras
🧾 .meupedido
🆔 .id
🏓 .ping
ℹ️ .ajuda

*ADMINISTRAÇÃO*
⚙️ .menuadmin
⚙️ .config
⚙️ .editarconfig PACOTE - PREÇO
⚙️ .removerconfig PACOTE
⚙️ .aprovar ID
⚙️ .recusar ID
⚙️ .enviar NÚMERO-PACOTE
⚙️ .stock PACOTE QUANTIDADE
⚙️ .lucro
⚙️ .fila
⚙️ .webhook URL
⚙️ .webhookgrupo URL
⚙️ .addmpesabot NÚMERO NOME
⚙️ .addemolabot NÚMERO NOME
⚙️ .antifoto on/off
⚙️ .antiaudio on/off
⚙️ .antivideo on/off
⚙️ .antistatus on/off
⚙️ .antilink on/off
⚙️ .detector on/off
⚙️ .compras on/off
⚙️ .aluguelbot on/off
⚙️ .precosbot
⚙️ .addprecobot DIAS PREÇO
⚙️ .nano PALAVRA | RESPOSTA
⚙️ .nanoremover PALAVRA

*GRUPOS*
.abrir | .fechar | .ban | .kick
.add | .promover | .rebaixar
.boasvindas on/off
.horario ABRIR FECHAR

╰━━━━━━━━━━━━━━━━━━╯`;
}

function menuAdmin() {
  return `╭━━━〔 ADMINISTRAÇÃO 〕━━━╮
📋 .config
💰 .editarconfig PACOTE - PREÇO
🗑️ .removerconfig PACOTE
🛒 .compras
🧾 .fila
✅ .aprovar ID
❌ .recusar ID
📤 .enviar NÚMERO-PACOTE
📦 .stock PACOTE QUANTIDADE
📈 .lucro
💳 .addmpesabot NÚMERO NOME
💳 .addemolabot NÚMERO NOME
🔗 .webhook URL
🔗 .webhookgrupo URL
🤖 .precosbot
🤖 .addprecobot DIAS PREÇO
🔑 .alugueis
🔑 .alugarc DIAS
⚙️ .aluguelbot on/off
🧠 .nano PALAVRA | RESPOSTA
🧠 .nanoremover PALAVRA
🛡️ .antifoto on/off
🛡️ .antiaudio on/off
🛡️ .antivideo on/off
🛡️ .antistatus on/off
🛡️ .antilink on/off
🛡️ .detector on/off
🛒 .compras on/off
╰━━━━━━━━━━━━━━━━━━╯`;
}

// ---------- LIGAÇÃO AO WHATSAPP ----------
async function iniciarBot() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSAO);

  const socket = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    browser: ["MEGAS PRO", "Chrome", "1.0.0"],
    markOnlineOnConnect: false,
    syncFullHistory: false
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("connection.update", update => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\n📱 LÊ ESTE QR CODE NO WHATSAPP:\n");
      qrcode.generate(qr, { small: true });
      console.log("\nWhatsApp > Dispositivos conectados > Conectar dispositivo");
    }

    if (connection === "open") {
      console.log(`\n✅ ${NOME_BOT} conectado!`);
      console.log("📁 Banco:", ARQUIVO);
    }

    if (connection === "close") {
      const codigo = lastDisconnect?.error?.output?.statusCode;
      if (codigo !== DisconnectReason.loggedOut) {
        console.log("Ligação fechada. A tentar reconectar...");
        setTimeout(iniciarBot, 3000);
      } else {
        console.log("Sessão terminada. Apaga auth_info_baileys e liga novamente para gerar QR.");
      }
    }
  });

  // ---------- FUNÇÕES DE MENSAGENS ----------
  async function responder(jid, texto, quoted) {
    return socket.sendMessage(jid, { text: texto }, quoted ? { quoted } : {});
  }

  async function eDono(remetente) {
    const n = numeroLimpo(remetente.split("@")[0]);
    const dono = numeroLimpo(dados.dono || DONO_NUMERO);
    const proprio = numeroLimpo(socket.user?.id?.split(":")[0] || "");
    return n === dono || (proprio && n === proprio);
  }

  async function eAdminGrupo(jid, remetente) {
    if (!jid.endsWith("@g.us")) return false;
    if (await eDono(remetente)) return true;
    try {
      const metadata = await socket.groupMetadata(jid);
      const participante = metadata.participants.find(p =>
        p.id === remetente || p.id.split(":")[0] === remetente.split(":")[0]
      );
      return Boolean(participante?.admin);
    } catch {
      return false;
    }
  }

  async function enviarWebhook(url, payload) {
    if (!url) {
      throw new Error("Webhook não configurado. Vamos configurar o MacroDroid na próxima etapa.");
    }

    const resposta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    });

    if (!resposta.ok) {
      throw new Error(`Webhook respondeu com HTTP ${resposta.status}`);
    }
    return true;
  }

  // ---------- BOAS-VINDAS ----------
  socket.ev.on("group-participants.update", async evento => {
    try {
      const conf = chaveGrupo(evento.id);
      if (!dados.boasVindas || !conf.boasVindas) return;

      for (const participante of evento.participants) {
        if (evento.action === "add") {
          await responder(
            evento.id,
            `👋 Bem-vindo(a) ao grupo!\n⚡ ${NOME_BOT}\n📶 Envia *Tabela* para veres os preços.`
          );
        }
      }
    } catch (e) {
      console.error("Erro boas-vindas:", e.message);
    }
  });

  // ---------- MENSAGENS RECEBIDAS ----------
  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      try {
        if (!msg.message || msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (!jid || jid === "status@broadcast") continue;

        const remetente = msg.key.participant || jid;
        const grupo = jid.endsWith("@g.us");
        const textoOriginal =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          msg.message.videoMessage?.caption ||
          msg.message.documentMessage?.caption ||
          "";

        const texto = textoOriginal.trim();
        const lower = texto.toLowerCase();
        const partes = texto.split(/\s+/);
        const comando = (partes[0] || "").toLowerCase();
        const args = partes.slice(1);
        const dono = await eDono(remetente);
        const admin = grupo ? await eAdminGrupo(jid, remetente) : dono;
        const confGrupo = grupo ? chaveGrupo(jid) : null;

        // ---------- PROTEÇÕES DE GRUPO ----------
        if (grupo && !admin) {
          const p = {
            antifoto: Boolean(msg.message.imageMessage),
            antiaudio: Boolean(msg.message.audioMessage || msg.message.pttMessage),
            antivideo: Boolean(msg.message.videoMessage),
            antilink: /(https?:\/\/|www\.|chat\.whatsapp\.com\/)/i.test(texto)
          };

          for (const [nome, detetado] of Object.entries(p)) {
            const ligado = confGrupo.protecoes[nome] ?? dados.protecoes[nome];
            if (detetado && ligado) {
              try {
                await socket.sendMessage(jid, { delete: msg.key });
                await responder(jid, `🛡️ Proteção ${nome} ativa. Mensagem removida.`);
              } catch (e) {
                console.log(`Não consegui aplicar ${nome}:`, e.message);
              }
              continue;
            }
          }
        }

        // ---------- NANO: RESPOSTAS AUTOMÁTICAS ----------
        const nanos = {
          ...(dados.nano || {}),
          ...(grupo ? (confGrupo.nano || {}) : {})
        };
        const encontrouNano = Object.keys(nanos).find(p =>
          p && lower.includes(p.toLowerCase())
        );
        if (encontrouNano && !comando.startsWith(".")) {
          await responder(jid, nanos[encontrouNano], msg);
        }

        // ---------- COMANDOS SEM PONTO ----------
        if (lower === "tabela") {
          await responder(jid, formatarTabela(), msg);
          continue;
        }

        if (lower === "pagamento" || lower === "pagamentos") {
          const mpesa = dados.mpesa.numero
            ? `${dados.mpesa.numero} — ${dados.mpesa.nome || "M-Pesa"}`
            : "Número ainda não configurado";
          const emola = dados.emola.numero
            ? `${dados.emola.numero} — ${dados.emola.nome || "e-Mola"}`
            : "Número ainda não configurado";

          await responder(jid,
            `💳 *FORMAS DE PAGAMENTO — ${NOME_BOT}*\n\n` +
            `📱 *M-Pesa:* ${mpesa}\n` +
            `📱 *e-Mola:* ${emola}\n\n` +
            `Depois de pagar, envia o comprovativo ao administrador.\n` +
            `⚠️ Confirma o nome do destinatário antes de transferir.`,
            msg
          );
          continue;
        }

        // ---------- COMANDOS GERAIS ----------
        if ([".menu", ".ajuda", ".start"].includes(comando)) {
          await responder(jid, menuTexto(), msg);
          continue;
        }

        if (comando === ".menuadmin") {
          if (!dono) {
            await responder(jid, "⛔ Apenas o dono pode usar este menu.", msg);
            continue;
          }
          await responder(jid, menuAdmin(), msg);
          continue;
        }

        if (comando === ".ping") {
          await responder(jid, "🏓 Pong! MEGAS PRO está ativo.", msg);
          continue;
        }

        if (comando === ".id") {
          await responder(jid, `🆔 ID: ${jid}\n👤 Remetente: ${remetente}`, msg);
          continue;
        }

        if (comando === ".meujid") {
          await responder(jid, `O teu ID é:\n${remetente}`, msg);
          continue;
        }

        if (comando === ".horas") {
          await responder(jid, `🕒 Hora do servidor: ${new Date().toLocaleString("pt-PT")}`, msg);
          continue;
        }

        if (comando === ".config") {
          if (!dono) continue;
          await responder(jid,
            "⚙️ *PREÇOS CONFIGURADOS*\n\n" +
            Object.entries(dados.config).map(([p, v]) => `${p} = ${v} MT`).join("\n"),
            msg
          );
          continue;
        }

        // ---------- COMPRA ----------
        if (comando === ".compra") {
          if (!dados.comprasLigadas) {
            await responder(jid, "🛒 As compras estão temporariamente desativadas.", msg);
            continue;
          }

          const pacote = textoPacote(args[0]);
          const numero = numeroLimpo(args[1] || remetente.split("@")[0]);

          if (!pacote || numero.length < 9) {
            await responder(jid,
              "❌ Formato incorreto.\nExemplo: *.compra 410MB 258844416510*\nEnvia *Tabela* para ver os pacotes.",
              msg
            );
            continue;
          }

          const id = `MP${Date.now().toString().slice(-8)}`;
          const pedido = {
            id,
            cliente: remetente,
            numero,
            pacote,
            preco: Number(dados.config[pacote]),
            estado: "PENDENTE",
            data: new Date().toISOString()
          };

          dados.compras.push(pedido);
          dados.fila.push(id);
          dados.clientes[remetente] = dados.clientes[remetente] || { compras: 0, gasto: 0 };
          guardar();

          await responder(jid,
            `✅ *PEDIDO REGISTADO*\n\n` +
            `🧾 Pedido: *${id}*\n` +
            `📦 Pacote: *${pacote}*\n` +
            `📱 Número: *${numero}*\n` +
            `💰 Valor: *${pedido.preco} MT*\n` +
            `📌 Estado: *PENDENTE*\n\n` +
            `Envia *Pagamento* para ver as formas de pagamento.\n` +
            `O pedido só será processado após confirmação do pagamento.`,
            msg
          );

          if (dados.dono) {
            await responder(
              `${numeroLimpo(dados.dono)}@s.whatsapp.net`,
              `🛒 *NOVO PEDIDO ${NOME_BOT}*\nID: ${id}\nCliente: ${remetente}\nNúmero: ${numero}\nPacote: ${pacote}\nPreço: ${pedido.preco} MT\nPara aprovar: .aprovar ${id}\nPara recusar: .recusar ${id}`
            );
          }
          continue;
        }

        if (comando === ".compras") {
          const minhas = dados.compras.filter(c => dono || c.cliente === remetente);
          if (!minhas.length) {
            await responder(jid, "Ainda não há pedidos registados.", msg);
            continue;
          }
          await responder(jid,
            minhas.slice(-20).map(c =>
              `🧾 ${c.id} | ${c.pacote} | ${c.preco} MT | ${c.estado}`
            ).join("\n"),
            msg
          );
          continue;
        }

        if (comando === ".meupedido") {
          const minhas = dados.compras.filter(c => c.cliente === remetente);
          await responder(jid, minhas.length
            ? minhas.slice(-5).map(c => `${c.id}: ${c.pacote} — ${c.estado}`).join("\n")
            : "Não tens pedidos registados.", msg);
          continue;
        }

        // ---------- APROVAR / RECUSAR PEDIDO ----------
        if (comando === ".aprovar" || comando === ".recusar") {
          if (!dono) {
            await responder(jid, "⛔ Só o dono pode aprovar ou recusar pedidos.", msg);
            continue;
          }

          const pedido = dados.compras.find(c => c.id === args[0]);
          if (!pedido) {
            await responder(jid, "❌ Pedido não encontrado. Usa .compras para consultar.", msg);
            continue;
          }

          if (pedido.estado !== "PENDENTE") {
            await responder(jid, `Este pedido já está ${pedido.estado}.`, msg);
            continue;
          }

          if (comando === ".recusar") {
            pedido.estado = "RECUSADO";
            dados.fila = dados.fila.filter(id => id !== pedido.id);
            guardar();
            await responder(jid, `❌ Pedido ${pedido.id} recusado.`, msg);
            await responder(pedido.cliente, `❌ O pedido ${pedido.id} foi recusado. Contacta o administrador.`);
            continue;
          }

          pedido.estado = "APROVADO";
          pedido.aprovadoEm = new Date().toISOString();
          dados.estatisticas.vendas += 1;
          dados.estatisticas.faturamento += Number(pedido.preco || 0);
          dados.clientes[pedido.cliente] = dados.clientes[pedido.cliente] || { compras: 0, gasto: 0 };
          dados.clientes[pedido.cliente].compras += 1;
          dados.clientes[pedido.cliente].gasto += Number(pedido.preco || 0);
          guardar();

          await responder(jid,
            `✅ Pedido ${pedido.id} aprovado.\nUsa .enviar ${pedido.numero}-${pedido.pacote} para iniciar a transferência quando o MacroDroid estiver configurado.`,
            msg
          );
          await responder(pedido.cliente,
            `✅ O pagamento do pedido ${pedido.id} foi marcado como aprovado.\n📦 Pacote: ${pedido.pacote}\nA transferência será processada quando o sistema estiver ligado.`
          );
          continue;
        }

        // ---------- TRANSFERÊNCIA VIA WEBHOOK ----------
        if (comando === ".enviar") {
          if (!dono) {
            await responder(jid, "⛔ Apenas o dono pode iniciar transferências.", msg);
            continue;
          }

          const entrada = args.join("").trim();
          let numero = "";
          let pacote = "";

          // Formato: 844395370-1030
          let match = entrada.match(/^(\d{9,15})-(\d+(?:\.\d+)?(?:MB|GB)?)$/i);
          if (match) {
            numero = match[1];
            pacote = match[2];
          } else {
            // Formato: 1030MB-844395370
            match = entrada.match(/^(\d+(?:\.\d+)?(?:MB|GB))-(\d{9,15})$/i);
            if (match) {
              pacote = match[1];
              numero = match[2];
            }
          }

          if (!numero || !pacote) {
            await responder(jid,
              "❌ Formato incorreto.\nExemplos:\n.enviar 844395370-1030\n.enviar 1030MB-844395370",
              msg
            );
            continue;
          }

          const url = (grupo && confGrupo.webhook) || dados.webhook;
          try {
            await enviarWebhook(url, {
              tipo: "TRANSFERIR_MEGAS",
              numero,
              pacote,
              cliente: remetente,
              grupo: grupo ? jid : "",
              data: new Date().toISOString()
            });
            dados.estatisticas.transferencias += 1;
            guardar();
            await responder(jid, `📤 Pedido de transferência enviado ao webhook.\n📱 Número: ${numero}\n📦 Pacote: ${pacote}\n⚠️ Confirma no MacroDroid se a transferência foi concluída.`, msg);
          } catch (e) {
            await responder(jid, `⚠️ Não foi possível enviar a transferência: ${e.message}\n\nO webhook ainda precisa de ser configurado no próximo passo.`, msg);
          }
          continue;
        }

        // ---------- ALTERAR PREÇOS ----------
        if (comando === ".editarconfig") {
          if (!dono) continue;
          const match = texto.match(/^\.editarconfig\s+(.+?)\s*-\s*(\d+(?:\.\d+)?)$/i);
          if (!match) {
            await responder(jid, "Formato: .editarconfig 100MB - 4", msg);
            continue;
          }
          const pacote = textoPacote(match[1]);
          if (!pacote) {
            await responder(jid, "Pacote não encontrado. Usa .config para consultar.", msg);
            continue;
          }
          dados.config[pacote] = Number(match[2]);
          guardar();
          await responder(jid, `✅ Preço de ${pacote} atualizado para ${match[2]} MT.`, msg);
          continue;
        }

        if (comando === ".removerconfig") {
          if (!dono) continue;
          const pacote = textoPacote(args.join(" "));
          if (!pacote) {
            await responder(jid, "❌ Pacote não encontrado.", msg);
            continue;
          }
          delete dados.config[pacote];
          guardar();
          await responder(jid, `🗑️ Pacote ${pacote} removido da tabela.`, msg);
          continue;
        }

        // ---------- CONFIGURAR PAGAMENTOS ----------
        if (comando === ".addmpesabot" || comando === ".addemolabot") {
          if (!dono) continue;
          if (args.length < 2) {
            await responder(jid, `Formato: ${comando} NUMERO NOME`, msg);
            continue;
          }
          const pagamento = {
            numero: args[0],
            nome: args.slice(1).join(" ")
          };
          if (comando === ".addmpesabot") dados.mpesa = pagamento;
          else dados.emola = pagamento;
          guardar();
          await responder(jid, "✅ Dados de pagamento guardados.", msg);
          continue;
        }

        // ---------- WEBHOOKS ----------
        if (comando === ".webhook") {
          if (!dono) continue;
          dados.webhook = args[0] || "";
          guardar();
          await responder(jid, dados.webhook
            ? "✅ Webhook geral guardado."
            : "Webhook geral apagado.", msg);
          continue;
        }

        if (comando === ".webhookgrupo") {
          if (!dono || !grupo) {
            await responder(jid, "Usa este comando dentro do grupo, como dono.", msg);
            continue;
          }
          confGrupo.webhook = args[0] || "";
          guardar();
          await responder(jid, confGrupo.webhook
            ? "✅ Webhook deste grupo guardado."
            : "Webhook deste grupo apagado.", msg);
          continue;
        }

        // ---------- STOCK / LUCRO / FILA ----------
        if (comando === ".stock") {
          if (!dono) continue;
          const pacote = textoPacote(args[0]);
          const quantidade = Number(args[1]);
          if (!pacote || !Number.isFinite(quantidade) || quantidade < 0) {
            await responder(jid, "Formato: .stock 410MB 100", msg);
            continue;
          }
          dados.stock[pacote] = quantidade;
          guardar();
          await responder(jid, `📦 Stock de ${pacote}: ${quantidade}`, msg);
          continue;
        }

        if (comando === ".lucro") {
          if (!dono) continue;
          await responder(jid,
            `📊 *RELATÓRIO ${NOME_BOT}*\n` +
            `Vendas aprovadas: ${dados.estatisticas.vendas}\n` +
            `Faturamento registado: ${dados.estatisticas.faturamento} MT\n` +
            `Transferências submetidas: ${dados.estatisticas.transferencias}\n` +
            `Pedidos registados: ${dados.compras.length}`,
            msg
          );
          continue;
        }

        if (comando === ".fila") {
          if (!dono) continue;
          const fila = dados.compras.filter(c => c.estado === "PENDENTE");
          await responder(jid, fila.length
            ? fila.map(c => `${c.id} | ${c.numero} | ${c.pacote} | ${c.preco} MT`).join("\n")
            : "A fila está vazia.", msg);
          continue;
        }

        // ---------- PROTEÇÕES ----------
        if (/^\.(antifoto|antiaudio|antivideo|antistatus|antilink|detector|compras|aluguelbot)$/.test(comando)) {
          if (!dono) continue;
          const nome = comando.slice(1);
          const valor = (args[0] || "").toLowerCase();

          if (!["on", "off"].includes(valor)) {
            await responder(jid, `Formato: ${comando} on ou ${comando} off`, msg);
            continue;
          }

          if (nome === "compras") dados.comprasLigadas = valor === "on";
          else if (nome === "aluguelbot") dados.aluguelLigado = valor === "on";
          else dados.protecoes[nome] = valor === "on";

          guardar();
          await responder(jid, `✅ ${nome}: ${valor.toUpperCase()}`, msg);
          continue;
        }

        // ---------- BOAS-VINDAS ----------
        if (comando === ".boasvindas") {
          if (!dono && !admin) continue;
          if (!grupo) {
            await responder(jid, "Este comando deve ser usado num grupo.", msg);
            continue;
          }
          const valor = (args[0] || "").toLowerCase();
          if (!["on", "off"].includes(valor)) {
            await responder(jid, "Formato: .boasvindas on ou .boasvindas off", msg);
            continue;
          }
          confGrupo.boasVindas = valor === "on";
          guardar();
          await responder(jid, `✅ Boas-vindas ${valor}.`, msg);
          continue;
        }

        // ---------- GRUPO ABRIR / FECHAR ----------
        if ([".abrir", ".fechar"].includes(comando)) {
          if (!grupo || !admin) {
            await responder(jid, "⛔ Precisas de ser administrador do grupo.", msg);
            continue;
          }
          try {
            await socket.groupSettingUpdate(jid, comando === ".abrir" ? "not_announcement" : "announcement");
            confGrupo.aberto = comando === ".abrir";
            guardar();
            await responder(jid, comando === ".abrir" ? "🔓 Grupo aberto." : "🔒 Grupo fechado.", msg);
          } catch {
            await responder(jid, "Não consegui alterar o grupo. Confirma se o bot é administrador.", msg);
          }
          continue;
        }

        // ---------- ADMINISTRAÇÃO DE PARTICIPANTES ----------
        if ([".ban", ".kick", ".add", ".promover", ".rebaixar"].includes(comando)) {
          if (!grupo || !admin) {
            await responder(jid, "⛔ Precisas de ser administrador do grupo.", msg);
            continue;
          }

          let alvo = msg.message.extendedTextMessage?.contextInfo?.participant;
          if (!alvo && args[0]) {
            const n = numeroLimpo(args[0]);
            if (n.length >= 9) alvo = `${n}@s.whatsapp.net`;
          }

          if (!alvo) {
            await responder(jid, `Marca a pessoa ou indica o número.\nExemplo: ${comando} 25884XXXXXXX`, msg);
            continue;
          }

          const acao = {
            ".ban": "remove",
            ".kick": "remove",
            ".add": "add",
            ".promover": "promote",
            ".rebaixar": "demote"
          }[comando];

          try {
            await socket.groupParticipantsUpdate(jid, [alvo], acao);
            await responder(jid, "✅ Comando executado.", msg);
          } catch {
            await responder(jid, "❌ Não foi possível executar. Confirma as permissões do bot.", msg);
          }
          continue;
        }

        // ---------- HORÁRIOS DE GRUPO ----------
        if (comando === ".horario") {
          if (!grupo || !admin) continue;
          if (!args[0] || !args[1]) {
            await responder(jid, "Formato: .horario 08:00 22:00", msg);
            continue;
          }
          confGrupo.horarioAbrir = args[0];
          confGrupo.horarioFechar = args[1];
          guardar();
          await responder(jid, `🕒 Horário guardado: abre ${args[0]}, fecha ${args[1]}.\nNota: a execução automática dos horários será ligada numa etapa adicional.`, msg);
          continue;
        }

        // ---------- NANO ----------
        if (comando === ".nano") {
          if (!dono) continue;
          const match = texto.match(/^\.nano\s+(.+?)\s*\|\s*(.+)$/i);
          if (!match) {
            await responder(jid, "Formato: .nano ola | Olá! Como posso ajudar?", msg);
            continue;
          }
          dados.nano[match[1].trim().toLowerCase()] = match[2].trim();
          guardar();
          await responder(jid, `✅ Resposta automática para "${match[1].trim()}" guardada.`, msg);
          continue;
        }

        if (comando === ".nanoremover") {
          if (!dono) continue;
          const palavra = args.join(" ").toLowerCase();
          delete dados.nano[palavra];
          guardar();
          await responder(jid, `🗑️ Resposta Nano removida: ${palavra}`, msg);
          continue;
        }

        // ---------- ALUGUER DO BOT ----------
        if (comando === ".precosbot") {
          await responder(jid,
            "🤖 *PREÇOS DE ALUGUER*\n" +
            Object.entries(dados.precosBot).map(([dias, preco]) => `${dias} dia(s): ${preco} MT`).join("\n"),
            msg
          );
          continue;
        }

        if (comando === ".addprecobot") {
          if (!dono) continue;
          const dias = Number(args[0]);
          const preco = Number(args[1]);
          if (!dias || !preco || preco < 1) {
            await responder(jid, "Formato: .addprecobot 30 500", msg);
            continue;
          }
          dados.precosBot[String(dias)] = preco;
          guardar();
          await responder(jid, `✅ Aluguer de ${dias} dia(s): ${preco} MT.`, msg);
          continue;
        }

        if (comando === ".alugarc") {
          if (!dados.aluguelLigado) {
            await responder(jid, "O aluguer está temporariamente desativado.", msg);
            continue;
          }
          const dias = Number(args[0]);
          const preco = dados.precosBot[String(dias)];
          if (!preco) {
            await responder(jid, "Período não encontrado. Usa .precosbot", msg);
            continue;
          }
          const id = `BOT-${Date.now().toString().slice(-8)}`;
          dados.alugueis.push({
            id,
            cliente: remetente,
            dias,
            preco,
            estado: "PENDENTE",
            data: new Date().toISOString()
          });
          guardar();
          await responder(jid, `🤖 *PEDIDO DE ALUGUER*\nCódigo: ${id}\nDuração: ${dias} dia(s)\nPreço: ${preco} MT\nEstado: PENDENTE\nContacta o dono para confirmar o pagamento.`, msg);
          continue;
        }

        if (comando === ".alugueis") {
          if (!dono) continue;
          await responder(jid, dados.alugueis.length
            ? dados.alugueis.slice(-20).map(a => `${a.id} | ${a.dias} dias | ${a.preco} MT | ${a.estado}`).join("\n")
            : "Ainda não existem pedidos de aluguer.", msg);
          continue;
        }

        if (comando === ".ativar") {
          if (!dono) continue;
          const aluguel = dados.alugueis.find(a => a.id === args[0]);
          if (!aluguel) {
            await responder(jid, "Código de aluguer não encontrado.", msg);
            continue;
          }
          aluguel.estado = "ATIVO";
          aluguel.terminaEm = new Date(Date.now() + aluguel.dias * 86400000).toISOString();
          guardar();
          await responder(jid, `✅ Aluguer ${aluguel.id} ativado até ${new Date(aluguel.terminaEm).toLocaleString("pt-PT")}.`, msg);
          await responder(aluguel.cliente, `🤖 O teu aluguer ${aluguel.id} foi ativado.`);
          continue;
        }

      } catch (erro) {
        console.error("Erro ao processar mensagem:", erro);
      }
    }
  });

  guardar();
}

iniciarBot().catch(erro => {
  console.error("Erro ao iniciar MEGAS PRO:", erro);
});
