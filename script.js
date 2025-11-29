let taxasEmReais = {
  BRL: 1.0,
  USD: 5.33,
  EUR: 6.15,
  GBP: 7.35,
  CHF: 6.5,
  CNY: 0.8,
  JPY: 0.038,
  ARS: 0.006,
  AUD: 3.5,
  CAD: 3.9,
  MXN: 0.31,
  INR: 0.064,
};

const simbolos = {
  BRL: "R$",
  USD: "US$",
  EUR: "€",
  GBP: "£",
  CHF: "Fr",
  CNY: "¥",
  JPY: "¥",
  ARS: "$",
  AUD: "A$",
  CAD: "C$",
  MXN: "MX$",
  INR: "₹",
  RUB: "₽",
};

const bandeiras = {
  BRL: "🇧🇷",
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  CHF: "🇨🇭",
  CNY: "🇨🇳",
  JPY: "🇯🇵",
  ARS: "🇦🇷",
  AUD: "🇦🇺",
  CAD: "🇨🇦",
  MXN: "🇲🇽",
  INR: "🇮🇳",
  RUB: "🇷🇺",
};

let historicoConversoes =
  JSON.parse(localStorage.getItem("historicoConversoes")) || [];
let taxasCache = JSON.parse(localStorage.getItem("taxasCache"));
let ultimaAtualizacaoTaxas = localStorage.getItem("ultimaAtualizacaoTaxas");

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js").catch(() => {});
}

document.addEventListener("DOMContentLoaded", () => {
  if (document.getElementById("lista-viagem")) {
    carregarLista();
  }

  if (document.getElementById("valor-moeda")) {
    carregarTaxas();
    adicionarAtalhosTeclado();
    carregarHistorico();
  }

  if (document.getElementById("cidade-input")) {
    const cidadeInput = document.getElementById("cidade-input");
    cidadeInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") buscarClima();
    });
  }

  if (document.getElementById("texto-para-traduzir")) {
    atualizarFrasesOffline();
  }

  configurarSOS();
});

async function carregarTaxas() {
  const agora = Date.now();
  const duasHoras = 2 * 60 * 60 * 1000;

  if (
    taxasCache &&
    ultimaAtualizacaoTaxas &&
    agora - parseInt(ultimaAtualizacaoTaxas) < duasHoras
  ) {
    taxasEmReais = taxasCache;
    mostrarNotificacao("Taxas carregadas do cache", "info");
    return;
  }
  await buscarTaxasAoVivo();
}

async function buscarTaxasAoVivo() {
  try {
    const response = await fetch(
      "https://economia.awesomeapi.com.br/last/USD-BRL,EUR-BRL,GBP-BRL,CHF-BRL,JPY-BRL,CNY-BRL,ARS-BRL,AUD-BRL,CAD-BRL,MXN-BRL,INR-BRL,RUB-BRL"
    );
    const data = await response.json();

    Object.keys(data).forEach((key) => {
      const moeda = key.substring(0, 3);
      taxasEmReais[moeda] = parseFloat(data[key].bid);
    });

    localStorage.setItem("taxasCache", JSON.stringify(taxasEmReais));
    localStorage.setItem("ultimaAtualizacaoTaxas", Date.now().toString());
    mostrarNotificacao("Taxas atualizadas!", "success");
  } catch (error) {
    mostrarNotificacao("Usando taxas offline", "warning");
  }
}

function converterMoeda() {
  const input = document.getElementById("valor-moeda");
  const valor = parseFloat(input.value);
  const origem = document.getElementById("moeda-origem").value;
  const destino = document.getElementById("moeda-destino").value;

  if (isNaN(valor) || valor < 0 || input.value === "") {
    mostrarNotificacao("Digite um valor válido!", "error");
    return;
  }

  const valorEmReais = valor * taxasEmReais[origem];
  const resultadoFinal = valorEmReais / taxasEmReais[destino];

  const saida = document.getElementById("resultado-moeda");
  saida.className = "resultado moeda-resultado";
  saida.innerHTML = `
    <span class="cotacao-label">Cotação Hoje</span><br>
    ${bandeiras[origem]} ${simbolos[origem]} ${valor.toFixed(2)} = <br>
    <strong>${bandeiras[destino]} ${simbolos[destino]} ${resultadoFinal.toFixed(
    2
  )}</strong>
  `;

  salvarHistoricoConversao(origem, destino, valor, resultadoFinal);
}

function inverterMoedas() {
  const origem = document.getElementById("moeda-origem");
  const destino = document.getElementById("moeda-destino");
  [origem.value, destino.value] = [destino.value, origem.value];
  converterMoeda();
}

function salvarHistoricoConversao(origem, destino, valor, resultado) {
  const conversao = {
    origem,
    destino,
    valor,
    resultado,
    timestamp: new Date().toLocaleString("pt-BR"),
  };
  historicoConversoes.unshift(conversao);
  historicoConversoes = historicoConversoes.slice(0, 5);
  localStorage.setItem(
    "historicoConversoes",
    JSON.stringify(historicoConversoes)
  );
  carregarHistorico();
}

function carregarHistorico() {
  const container = document.getElementById("historico-conversoes");
  if (!container) return;

  if (historicoConversoes.length === 0) {
    container.innerHTML =
      '<p class="timestamp" style="font-size:0.8rem;">Nenhuma conversão recente</p>';
    return;
  }

  container.innerHTML =
    "<h4>Últimas Conversões</h4>" +
    historicoConversoes
      .map(
        (c) => `
    <div class="historico-item">
      <span>${bandeiras[c.origem] || ""} ${c.valor.toFixed(2)} → ${
          bandeiras[c.destino] || ""
        } ${c.resultado.toFixed(2)}</span>
      <span class="timestamp">${c.timestamp}</span>
    </div>
  `
      )
      .join("");
}

function adicionarAtalhosTeclado() {
  const input = document.getElementById("valor-moeda");
  if (input) {
    input.addEventListener("keypress", (e) => {
      if (e.key === "Enter") converterMoeda();
    });
  }
}

async function buscarClima() {
  const cidadeInput = document.getElementById("cidade-input");
  const loading = document.getElementById("loading-clima");
  const resultado = document.getElementById("resultado-clima");
  let erroInline = document.getElementById("erro-clima-inline");
  if (!erroInline) {
    erroInline = document.createElement("div");
    erroInline.id = "erro-clima-inline";
    erroInline.style.cssText =
      "margin-top:12px;font-size:0.85rem;color:#ef4444;font-weight:500;display:none;";
    loading?.parentElement?.insertBefore(erroInline, loading);
  }

  if (!cidadeInput || !loading || !resultado) {
    console.error("Elementos não encontrados");
    return;
  }

  const cidade = cidadeInput.value.trim();

  if (!cidade) {
    mostrarNotificacao("Digite uma cidade!", "warning");
    return;
  }

  loading.style.display = "block";
  resultado.style.display = "none";
  erroInline.style.display = "none";

  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
        cidade
      )}&count=1&language=pt&format=json`
    );
    if (!geoRes.ok) throw new Error("Erro na API de geocoding");
    const geoData = await geoRes.json();

    if (!geoData.results || geoData.results.length === 0) {
      throw new Error("Cidade não encontrada");
    }

    const { latitude, longitude, name, country } = geoData.results[0];
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`
    );
    if (!weatherRes.ok) throw new Error("Erro na API de clima");
    const weatherData = await weatherRes.json();

    if (!weatherData.current_weather) {
      throw new Error("Dados de clima não disponíveis");
    }

    const tempElem = document.getElementById("weather-temp");
    const cityElem = document.getElementById("weather-city");
    const descElem = document.getElementById("weather-desc");
    const iconElem = document.getElementById("weather-icon");

    const temp = Math.round(weatherData.current_weather.temperature);
    const cityName = `${name}${country ? ", " + country : ""}`;
    const info = interpretarClima(weatherData.current_weather.weathercode || 0);

    if (tempElem) tempElem.textContent = `${temp}°C`;
    if (cityElem) cityElem.textContent = cityName;
    if (descElem) descElem.textContent = info.desc;
    if (iconElem) iconElem.className = `weather-icon ${info.icon}`;

    resultado.style.display = "block";
    mostrarNotificacao("Clima atualizado!", "success");
  } catch (error) {
    mostrarNotificacao(`Erro: ${error.message}`, "error");
    erroInline.textContent =
      error.message === "Cidade não encontrada"
        ? "Cidade não encontrada. Verifique a grafia."
        : "Não foi possível obter o clima agora.";
    erroInline.style.display = "block";
  } finally {
    loading.style.display = "none";
  }
}

function interpretarClima(code) {
  if (code === 0) return { desc: "Céu Limpo", icon: "ph ph-sun" };
  if (code <= 3)
    return { desc: "Parcialmente Nublado", icon: "ph ph-cloud-sun" };
  if (code <= 48) return { desc: "Nevoeiro", icon: "ph ph-cloud-fog" };
  if (code <= 67) return { desc: "Chuva", icon: "ph ph-cloud-rain" };
  if (code <= 77) return { desc: "Neve", icon: "ph ph-snowflake" };
  return { desc: "Tempestade", icon: "ph ph-cloud-lightning" };
}

function converterMedida() {
  const valor = parseFloat(document.getElementById("valor-medida").value);
  const tipo = document.getElementById("tipo-medida").value;
  const saida = document.getElementById("resultado-medida");
  if (isNaN(valor)) return mostrarNotificacao("Digite um número!", "error");
  let res = 0,
    und = "";
  switch (tipo) {
    case "c-f":
      res = (valor * 9) / 5 + 32;
      und = "°F";
      break;
    case "f-c":
      res = ((valor - 32) * 5) / 9;
      und = "°C";
      break;
    case "km-mi":
      res = valor * 0.621371;
      und = "mi";
      break;
    case "mi-km":
      res = valor / 0.621371;
      und = "km";
      break;
    case "kg-lb":
      res = valor * 2.20462;
      und = "lb";
      break;
    case "lb-kg":
      res = valor / 2.20462;
      und = "kg";
      break;
    case "l-gal":
      res = valor * 0.264172;
      und = "gal";
      break;
    case "gal-l":
      res = valor / 0.264172;
      und = "l";
      break;
  }
  saida.innerText = `Resultado: ${res.toFixed(2)} ${und}`;
}

function adicionarItem() {
  const input = document.getElementById("item-input");
  if (!input.value.trim()) return;
  criarElementoLista(input.value, false);
  salvarLista();
  input.value = "";
  input.focus();
}

function criarElementoLista(texto, feito) {
  const ul = document.getElementById("lista-viagem");
  const li = document.createElement("li");
  if (feito) li.classList.add("checked");

  li.innerHTML = `
    <span onclick="toggleCheck(this)" class="item-text">${texto}</span>
    <button class="btn-delete" onclick="removerItem(this)">
        <i class="ph ph-trash"></i>
    </button>
  `;
  ul.appendChild(li);
}

function toggleCheck(span) {
  span.parentElement.classList.toggle("checked");
  salvarLista();
}

function removerItem(btn) {
  btn.closest("li").remove();
  salvarLista();
}

function salvarLista() {
  const itens = Array.from(document.querySelectorAll("#lista-viagem li")).map(
    (li) => ({
      texto: li.querySelector(".item-text").innerText,
      feito: li.classList.contains("checked"),
    })
  );
  localStorage.setItem("minhaListaViagem", JSON.stringify(itens));
  atualizarProgresso();
}

function carregarLista() {
  const itens = JSON.parse(localStorage.getItem("minhaListaViagem")) || [];
  itens.forEach((i) => criarElementoLista(i.texto, i.feito));
  atualizarProgresso();
}

function atualizarProgresso() {
  const total = document.querySelectorAll("#lista-viagem li").length;
  const feitos = document.querySelectorAll("#lista-viagem li.checked").length;
  const pct = total === 0 ? 0 : Math.round((feitos / total) * 100);

  const fill = document.getElementById("progress-fill");
  if (fill) fill.style.width = `${pct}%`;

  const texto = document.getElementById("progress-text");
  if (texto) texto.innerText = `${feitos}/${total}`;

  const pctTexto = document.getElementById("progress-percent");
  if (pctTexto) pctTexto.innerText = `${pct}%`;

  const emptyState = document.getElementById("empty-state");
  if (emptyState) emptyState.style.display = total === 0 ? "block" : "none";
  if (pct === 100 && total > 0) dispararConfetes();
}

function adicionarPacote(tipo) {
  const pacotes = {
    praia: [
      "Protetor Solar",
      "Óculos de Sol",
      "Roupa de Banho",
      "Toalha",
      "Chinelos",
    ],
    frio: ["Casaco Pesado", "Luvas", "Gorro", "Segunda Pele", "Botas"],
    internacional: [
      "Passaporte",
      "Adaptador de Tomada",
      "Seguro Viagem",
      "Cartão de Crédito",
      "Visto",
    ],
  };
  pacotes[tipo].forEach((item) => criarElementoLista(item, false));
  salvarLista();
  mostrarNotificacao("Pacote adicionado com sucesso!", "success");
}

function limparLista() {
  if (confirm("Tem certeza que quer apagar toda a lista?")) {
    document.getElementById("lista-viagem").innerHTML = "";
    salvarLista();
  }
}

function exportarChecklist() {
  const itens = JSON.parse(localStorage.getItem("minhaListaViagem")) || [];
  if (itens.length === 0)
    return mostrarNotificacao("A lista está vazia!", "warning");
  const texto =
    "MINHA LISTA DE VIAGEM - BAGUNCINHA\n\n" +
    itens.map((i) => `[${i.feito ? "X" : " "}] ${i.texto}`).join("\n");
  const blob = new Blob([texto], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "checklist-viagem.txt";
  a.click();
}

function importarChecklist() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".txt";
  input.onchange = (e) => {
    const reader = new FileReader();
    reader.onload = (ev) => {
      ev.target.result.split("\n").forEach((linha) => {
        if (linha.includes("]")) {
          const textoLimpo = linha.split("]")[1].trim();
          const feito = linha.includes("[X]");
          if (textoLimpo) criarElementoLista(textoLimpo, feito);
        }
      });
      salvarLista();
      mostrarNotificacao("Lista importada!", "success");
    };
    reader.readAsText(e.target.files[0]);
  };
  input.click();
}

function calcularOrcamento() {
  const campos = [
    { id: "hospedagem", label: "Hospedagem" },
    { id: "alimentacao", label: "Alimentação" },
    { id: "transporte", label: "Transporte" },
    { id: "atracoes", label: "Atrações/Passeios" },
    { id: "compras", label: "Compras" },
    { id: "outros", label: "Outros" },
  ];

  let total = 0;
  let htmlDetalhamento = "";
  const moedaSelect = document.getElementById("moeda-orcamento");

  if (!moedaSelect) {
    mostrarNotificacao("Erro: elemento moeda não encontrado", "error");
    return;
  }

  const moeda = moedaSelect.value;
  const simbolo = simbolos[moeda] || moeda;

  campos.forEach((campo) => {
    const input = document.getElementById(campo.id);
    if (!input) return;

    const val = parseFloat(input.value) || 0;
    total += val;

    if (val > 0) {
      htmlDetalhamento += `<div class="breakdown-item"><span>${
        campo.label
      }</span><strong>${simbolo} ${val.toFixed(2)}</strong></div>`;
    }
  });

  const resultadoElem = document.getElementById("resultado-orcamento");
  const breakdownElem = document.getElementById("breakdown-orcamento");

  if (resultadoElem) {
    if (total === 0) {
      resultadoElem.innerHTML = `<p style="color:#64748b;">Digite valores acima para calcular</p>`;
    } else {
      resultadoElem.innerHTML = `<strong style="font-size:1.5rem;color:var(--cor-principal);">Total: ${simbolo} ${total.toFixed(
        2
      )}</strong>`;
    }
  }

  if (breakdownElem) {
    if (htmlDetalhamento) {
      breakdownElem.innerHTML =
        "<h4 style='margin-bottom:12px;color:var(--cor-texto);'>Detalhamento:</h4>" +
        htmlDetalhamento;
      breakdownElem.classList.remove("hidden");
      breakdownElem.style.display = "block";
    } else {
      breakdownElem.classList.add("hidden");
      breakdownElem.style.display = "none";
    }
  }
}

async function traduzirAgora() {
  const texto = document.getElementById("texto-para-traduzir").value;
  const origem = document.getElementById("idioma-origem").value;
  const destino = document.getElementById("idioma-destino").value;
  const resultadoDiv = document.getElementById("resultado-traducao");
  const textoDestino = document.getElementById("texto-traduzido");
  if (!texto.trim()) {
    mostrarNotificacao("Digite algo para traduzir!", "warning");
    return;
  }
  textoDestino.innerText = "Traduzindo...";
  textoDestino.style.opacity = "0.5";
  resultadoDiv.classList.remove("hidden");
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
      texto
    )}&langpair=${origem}|${destino}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.responseStatus === 200 || data.responseData.translatedText) {
      textoDestino.innerText = data.responseData.translatedText;
      textoDestino.style.opacity = "1";
    } else {
      textoDestino.innerText = "Não foi possível traduzir.";
    }
  } catch (error) {
    textoDestino.innerText = "Erro de conexão. Verifique a internet.";
    mostrarNotificacao("Você está offline?", "error");
  }
}

function mostrarBotaoLimpar() {
  const texto = document.getElementById("texto-para-traduzir").value;
  const btn = document.getElementById("btn-limpar");
  if (btn) {
    if (texto.length > 0) btn.classList.remove("hidden");
    else btn.classList.add("hidden");
  }
}

function limparTexto() {
  const input = document.getElementById("texto-para-traduzir");
  input.value = "";
  input.focus();
  mostrarBotaoLimpar();
  document.getElementById("resultado-traducao").classList.add("hidden");
}

function falarTraducao() {
  const texto = document.getElementById("texto-traduzido").innerText;
  const idioma = document.getElementById("idioma-destino").value;
  falarTexto(texto, idioma);
}

function falarTexto(texto, langCode) {
  const mapVoz = {
    en: "en-US",
    es: "es-ES",
    fr: "fr-FR",
    it: "it-IT",
    de: "de-DE",
    ja: "ja-JP",
    zh: "zh-CN",
    ru: "ru-RU",
    "pt-BR": "pt-BR",
  };
  const utterance = new SpeechSynthesisUtterance(texto);
  utterance.lang = mapVoz[langCode] || langCode;
  window.speechSynthesis.speak(utterance);
}

const frasesOfflineData = [
  { pt: "Olá / Bom dia", key: "ola" },
  { pt: "Obrigado(a)", key: "obrigado" },
  { pt: "Por favor", key: "porfavor" },
  { pt: "Onde fica o banheiro?", key: "banheiro" },
  { pt: "Quanto custa?", key: "quanto" },
  { pt: "Eu não entendo", key: "naoentendo" },
  { pt: "A conta, por favor", key: "conta" },
];

const traducoesOfflineDB = {
  en: {
    ola: "Hello",
    obrigado: "Thank you",
    porfavor: "Please",
    banheiro: "Where is the restroom?",
    quanto: "How much?",
    naoentendo: "I don't understand",
    conta: "Check please",
  },
  es: {
    ola: "Hola",
    obrigado: "Gracias",
    porfavor: "Por favor",
    banheiro: "¿Dónde está el baño?",
    quanto: "¿Cuánto cuesta?",
    naoentendo: "No entiendo",
    conta: "La cuenta",
  },
  fr: {
    ola: "Bonjour",
    obrigado: "Merci",
    porfavor: "S'il vous plaît",
    banheiro: "Où sont les toilettes?",
    quanto: "Combien ça coûte?",
    naoentendo: "Je ne comprends pas",
    conta: "L'addition",
  },
  it: {
    ola: "Ciao",
    obrigado: "Grazie",
    porfavor: "Per favore",
    banheiro: "Dov'è il bagno?",
    quanto: "Quanto costa?",
    naoentendo: "Non capisco",
    conta: "Il conto",
  },
  de: {
    ola: "Hallo",
    obrigado: "Danke",
    porfavor: "Bitte",
    banheiro: "Wo ist die Toilette?",
    quanto: "Wie viel?",
    naoentendo: "Ich verstehe nicht",
    conta: "Die Rechnung",
  },
  ja: {
    ola: "Konnichiwa",
    obrigado: "Arigato",
    porfavor: "Onegaishimasu",
    banheiro: "Toire wa doko?",
    quanto: "Ikura desu ka?",
    naoentendo: "Wakarimasen",
    conta: "Okanjō",
  },
  zh: {
    ola: "Nǐ hǎo",
    obrigado: "Xièxiè",
    porfavor: "Qǐng",
    banheiro: "Cèsuǒ zài nǎlǐ?",
    quanto: "Duōshǎo qián?",
    naoentendo: "Wǒ bù míngbái",
    conta: "Mǎidān",
  },
  ru: {
    ola: "Privet",
    obrigado: "Spasibo",
    porfavor: "Pozhaluysta",
    banheiro: "Gde tualet?",
    quanto: "Skol'ko?",
    naoentendo: "Ya ne ponimayu",
    conta: "Schet, pozhaluysta",
  },
};

function atualizarFrasesOffline() {
  const container = document.getElementById("lista-frases-rapidas");

  const idioma = document.getElementById("idioma-destino").value;

  if (!container) return;

  container.innerHTML = "";

  frasesOfflineData.forEach((frase) => {
    // Se não houver tradução, põe "..."
    const trad = traducoesOfflineDB[idioma]
      ? traducoesOfflineDB[idioma][frase.key]
      : "...";

    const div = document.createElement("div");
    div.className = "card-item";

    div.style.cssText =
      "flex-direction: row; justify-content: space-between; padding: 15px; text-align: left; margin-bottom: 10px;";

    div.innerHTML = `
      <div>
        <strong style="color:var(--cor-principal); display:block; font-size:1.1rem">${trad}</strong>
        <small style="opacity:0.7; color:var(--cor-texto-secundario)">${frase.pt}</small>
      </div>
      <button onclick="falarTexto('${trad}', '${idioma}')" class="btn-icon" style="width:40px; height:40px; border-radius:50%">
        <i class="ph ph-speaker-high"></i>
      </button>
    `;
    container.appendChild(div);
  });
}

function mostrarNotificacao(msg, tipo) {
  let container = document.getElementById("toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.appendChild(container);
  }
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `<i class="ph ph-info"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 10);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function dispararConfetes() {
  mostrarNotificacao("Mala pronta! Boa viagem! 🎉✈️", "success");
}

const divOffline = document.createElement("div");
divOffline.id = "aviso-offline";
divOffline.innerHTML = '<i class="ph ph-airplane-tilt"></i> Você está offline.';
document.body.appendChild(divOffline);

window.addEventListener("online", atualizarStatusRede);
window.addEventListener("offline", atualizarStatusRede);
atualizarStatusRede();

function atualizarStatusRede() {
  if (navigator.onLine) {
    divOffline.classList.remove("visivel");
    document.body.classList.remove("offline-mode");
  } else {
    divOffline.classList.add("visivel");
    document.body.classList.add("offline-mode");
  }
}

const dadosEmergencia = {
  EU: {
    nome: "Europa (Geral)",
    policia: "112",
    ambulancia: "112",
    bombeiros: "112",
  },
  US: { nome: "EUA", policia: "911", ambulancia: "911", bombeiros: "911" },
  BR: { nome: "Brasil", policia: "190", ambulancia: "192", bombeiros: "193" },
  JP: { nome: "Japão", policia: "110", ambulancia: "119", bombeiros: "119" },
  AR: {
    nome: "Argentina",
    policia: "911",
    ambulancia: "107",
    bombeiros: "100",
  },
  GB: {
    nome: "Reino Unido",
    policia: "999",
    ambulancia: "999",
    bombeiros: "999",
  },
  CA: { nome: "Canadá", policia: "911", ambulancia: "911", bombeiros: "911" },
  CN: { nome: "China", policia: "110", ambulancia: "120", bombeiros: "119" },
  AU: {
    nome: "Austrália",
    policia: "000",
    ambulancia: "000",
    bombeiros: "000",
  },
};

function atualizarNumerosEmergencia() {
  const select = document.getElementById("select-pais-sos");
  const resultadoDiv = document.getElementById("resultado-sos-dinamico");
  if (!select || !resultadoDiv) return;
  const codigoPais = select.value;
  const dados = dadosEmergencia[codigoPais];
  if (dados) {
    resultadoDiv.innerHTML = `
      <div class="item-emergencia fade-in"><span>🚓 Polícia</span><strong><a href="tel:${dados.policia}">${dados.policia}</a></strong></div>
      <div class="item-emergencia fade-in"><span>🚑 Ambulância</span><strong><a href="tel:${dados.ambulancia}">${dados.ambulancia}</a></strong></div>
      <div class="item-emergencia fade-in"><span>🚒 Bombeiros</span><strong><a href="tel:${dados.bombeiros}">${dados.bombeiros}</a></strong></div>
    `;
  }
}

window.toggleSOS = function () {
  const modal = document.getElementById("modal-sos");
  if (modal) modal.classList.toggle("hidden");
};

function configurarSOS() {
  const modal = document.getElementById("modal-sos");
  if (!modal) return;
  const btnFechar = modal.querySelector(".btn-icon");
  if (btnFechar) btnFechar.onclick = window.toggleSOS;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) window.toggleSOS();
  });
}
