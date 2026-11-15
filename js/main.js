// @ts-nocheck
import { NEXORA_CONFIG } from "./config.js";

var STORAGE_KEY = "nexora-owner-v1";
var bound = false;
var editing = false;
var current = null;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function money(value) {
  var amount = Math.round(Number(value) || 0);
  return "R$\u00a0" + amount.toLocaleString("pt-BR");
}

function normalizeWa(input) {
  var digits = String(input || "").replace(/\D/g, "");
  if (digits.indexOf("00") === 0) digits = digits.slice(2);
  digits = digits.replace(/^0+/, "");
  if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
  return digits;
}

function formatPhone(digits) {
  if (digits.length === 13) {
    return "+" + digits.slice(0, 2) + " " + digits.slice(2, 4) + " " + digits.slice(4, 9) + "-" + digits.slice(9);
  }
  if (digits.length === 12) {
    return "+" + digits.slice(0, 2) + " " + digits.slice(2, 4) + " " + digits.slice(4, 8) + "-" + digits.slice(8);
  }
  return digits ? "+" + digits : "";
}

function loadOverride() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    if (!data || typeof data !== "object") return null;
    return data;
  } catch (err) {
    return null;
  }
}

function activeConfig() {
  var cfg = clone(NEXORA_CONFIG);
  var over = loadOverride();
  if (!over) return cfg;
  cfg._local = true;
  ["whatsapp", "email", "instagram", "cidade", "horario", "siteUrl"].forEach(function (key) {
    if (typeof over[key] === "string") cfg[key] = over[key].trim();
  });
  if (Array.isArray(over.services)) {
    over.services.forEach(function (item) {
      if (!item || typeof item.id !== "string") return;
      var target = cfg.services.find(function (service) {
        return service.id === item.id;
      });
      if (!target) return;
      var price = Number(item.price);
      if (Number.isFinite(price) && price >= 0 && price <= 999999) target.price = Math.round(price);
      if (typeof item.prazo === "string" && item.prazo.trim()) target.prazo = item.prazo.trim().slice(0, 80);
    });
  }
  return cfg;
}

function serviceById(id) {
  var cfg = current || activeConfig();
  return cfg.services.find(function (service) {
    return service.id === id;
  }) || null;
}

function valueOf(form, name) {
  var field = form.elements.namedItem(name);
  if (!field || !("value" in field)) return "";
  return String(field.value || "");
}

function setValue(id, value) {
  var field = document.getElementById(id);
  if (!field || document.activeElement === field) return;
  field.value = value;
}

function waUrl(cfg, text) {
  var digits = normalizeWa(cfg.whatsapp);
  if (!/^55\d{10,11}$/.test(digits)) return "";
  return "https://wa.me/" + digits + "?text=" + encodeURIComponent(text);
}

function showStatus(node, message, link) {
  if (!node) return;
  node.hidden = false;
  node.replaceChildren();
  node.append(document.createTextNode(message));
  if (link) {
    node.append(document.createTextNode(" "));
    var anchor = document.createElement("a");
    anchor.href = link.href;
    anchor.textContent = link.label;
    anchor.className = "text-link";
    if (link.external) {
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
    }
    node.append(anchor);
  }
}

function clearFieldErrors(form) {
  form.querySelectorAll("[data-error-for]").forEach(function (node) {
    node.hidden = true;
    node.textContent = "";
  });
  form.querySelectorAll("[aria-invalid]").forEach(function (field) {
    field.removeAttribute("aria-invalid");
  });
}

function setFieldError(form, name, message) {
  var field = form.elements.namedItem(name);
  var note = form.querySelector('[data-error-for="' + name + '"]');
  if (field && "setAttribute" in field) field.setAttribute("aria-invalid", "true");
  if (note) {
    note.hidden = false;
    note.textContent = message;
  }
}

function updateServiceMeta() {
  var select = document.getElementById("servico");
  var meta = document.getElementById("servico-meta");
  if (!select || !meta) return;
  var service = serviceById(select.value);
  meta.textContent = service
    ? "Valor inicial: " + money(service.price) + ". Prazo estimado: " + service.prazo + ". O valor final é confirmado por mensagem."
    : "Escolha um serviço para ver o valor inicial publicado.";
}

function applyCanonical(cfg) {
  var url = String(cfg.siteUrl || "").replace(/\/$/, "");
  if (!/^https:\/\/\S+$/i.test(url)) return;
  var link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.setAttribute("rel", "canonical");
    document.head.appendChild(link);
  }
  var path = window.location.pathname.replace(/^\/hds-[a-z0-9]+-\d+-[a-z0-9]+/i, "") || "/";
  link.setAttribute("href", url + (path.startsWith("/") ? path : "/" + path));
}

function applyLinkedData(cfg) {
  var node = document.getElementById("ld-nexora");
  if (!node) return;
  var data = {
    "@context": "https://schema.org",
    "@type": "ProfessionalService",
    name: "NEXORA",
    description: "Criação de sites, landing pages, cardápios digitais, artes para redes sociais e identidade visual. Orçamento pelo WhatsApp.",
    areaServed: "BR",
    knowsLanguage: "pt-BR",
    hasOfferCatalog: {
      "@type": "OfferCatalog",
      name: "Serviços digitais",
      itemListElement: cfg.services.map(function (service, index) {
        return {
          "@type": "Offer",
          position: index + 1,
          name: service.name,
          price: String(service.price),
          priceCurrency: "BRL",
          description: "Valor inicial. O preço final é confirmado por mensagem, conforme o escopo."
        };
      })
    }
  };
  if (cfg.siteUrl) data.url = cfg.siteUrl;
  if (cfg.email) data.email = cfg.email;
  if (/^55\d{10,11}$/.test(normalizeWa(cfg.whatsapp))) data.telephone = "+" + normalizeWa(cfg.whatsapp);
  node.textContent = JSON.stringify(data);
}

function apply(cfg) {
  current = cfg;
  var page = document.querySelector("[data-nexora]");
  if (page) page.classList.toggle("is-editing", editing);
  var editButton = document.querySelector("[data-edit-toggle]");
  if (editButton) {
    editButton.textContent = editing ? "Fechar edição" : "Editar tabela";
    editButton.setAttribute("aria-expanded", editing ? "true" : "false");
  }

  cfg.services.forEach(function (service) {
    document.querySelectorAll('[data-price="' + service.id + '"]').forEach(function (node) {
      node.textContent = money(service.price);
    });
    document.querySelectorAll('[data-prazo="' + service.id + '"]').forEach(function (node) {
      node.textContent = service.prazo;
    });
    setValue("price-" + service.id, String(service.price));
    setValue("prazo-" + service.id, service.prazo);
  });

  setValue("owner-whatsapp", cfg.whatsapp || "");
  setValue("owner-email", cfg.email || "");
  setValue("owner-instagram", cfg.instagram || "");
  setValue("owner-cidade", cfg.cidade || "");
  setValue("owner-horario", cfg.horario || "");
  setValue("owner-site", cfg.siteUrl || "");

  document.querySelectorAll("[data-bind='cidade']").forEach(function (node) {
    node.textContent = cfg.cidade || "";
  });
  document.querySelectorAll("[data-bind='horario']").forEach(function (node) {
    node.textContent = cfg.horario || "";
  });

  var digits = normalizeWa(cfg.whatsapp);
  var ready = /^55\d{10,11}$/.test(digits);
  document.querySelectorAll("[data-wa]").forEach(function (anchor) {
    var text = anchor.getAttribute("data-wa-text") || "Olá, NEXORA. Quero um orçamento.";
    anchor.setAttribute("href", ready ? waUrl(cfg, text) : "/precos#editar");
    if (ready) {
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
    } else {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
    }
  });
  document.querySelectorAll("[data-channel='whatsapp']").forEach(function (anchor) {
    anchor.textContent = ready ? formatPhone(digits) : "Configurar número do estúdio";
  });

  var emailLink = document.querySelector("[data-email-link]");
  if (emailLink) {
    if (cfg.email) {
      emailLink.textContent = cfg.email;
      emailLink.setAttribute("href", "mailto:" + cfg.email);
    } else {
      emailLink.textContent = "Configurar e-mail";
      emailLink.setAttribute("href", "/precos#editar");
    }
  }

  var instagramRow = document.querySelector("[data-instagram-row]");
  if (instagramRow) {
    var instagramLink = instagramRow.querySelector("a");
    if (cfg.instagram && instagramLink) {
      instagramRow.hidden = false;
      instagramLink.textContent = "@" + cfg.instagram;
      instagramLink.setAttribute("href", "https://instagram.com/" + cfg.instagram);
    } else {
      instagramRow.hidden = true;
    }
  }

  var setup = document.getElementById("setup-note");
  if (setup) setup.hidden = ready;

  var banner = document.getElementById("local-banner");
  if (banner) {
    banner.hidden = !cfg._local;
    if (cfg._local) {
      banner.textContent = "Estes dados estão salvos só neste navegador. Visitantes continuam vendo o arquivo js/config.js até você substituí-lo e publicar de novo. O preço oficial é o que você confirmar no WhatsApp.";
    }
  }

  var select = document.getElementById("servico");
  if (select && select.dataset.ready !== "1") {
    select.dataset.ready = "1";
    var chosen = new URLSearchParams(window.location.search).get("servico");
    if (chosen && Array.prototype.some.call(select.options, function (option) { return option.value === chosen; })) {
      select.value = chosen;
    }
  }
  updateServiceMeta();

  document.querySelectorAll("[data-year]").forEach(function (node) {
    node.textContent = String(new Date().getFullYear());
  });
  applyCanonical(cfg);
  applyLinkedData(cfg);
}

function readEditor(form) {
  var base = clone(NEXORA_CONFIG);
  var errors = [];
  var whatsapp = normalizeWa(valueOf(form, "whatsapp"));
  if (whatsapp && !/^55\d{10,11}$/.test(whatsapp)) {
    errors.push("WhatsApp: use DDI 55, DDD e número. Exemplo: 5511987654321. Se digitar só DDD e número, o 55 entra sozinho.");
  }
  var email = valueOf(form, "email").trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("E-mail inválido. Deixe em branco se não quiser publicar.");
  }
  var instagram = valueOf(form, "instagram").trim().replace(/^@+/, "");
  if (instagram && !/^[A-Za-z0-9._]{1,30}$/.test(instagram)) {
    errors.push("Instagram: só letras, números, ponto e sublinhado, sem @.");
  }
  var siteUrl = valueOf(form, "siteUrl").trim().replace(/\/$/, "");
  if (siteUrl && !/^https:\/\/\S+$/i.test(siteUrl)) {
    errors.push("URL do site: comece com https:// e não use espaços. Ou deixe em branco.");
  }
  var cidade = valueOf(form, "cidade").trim();
  var horario = valueOf(form, "horario").trim();
  if (!cidade || !horario) errors.push("Atendimento e horário não podem ficar vazios.");

  var services = base.services.map(function (service) {
    var rawPrice = valueOf(form, "price_" + service.id).trim();
    var prazo = valueOf(form, "prazo_" + service.id).trim();
    if (!/^\d+$/.test(rawPrice) || Number(rawPrice) > 999999) {
      errors.push("Preço de " + service.name + ": use um número inteiro, sem R$ e sem centavos.");
    }
    if (!prazo || prazo.length > 80) {
      errors.push("Prazo de " + service.name + ": escreva até 80 caracteres.");
    }
    return {
      id: service.id,
      name: service.name,
      price: /^\d+$/.test(rawPrice) ? Number(rawPrice) : service.price,
      prazo: prazo || service.prazo
    };
  });

  return {
    errors: errors,
    cfg: {
      whatsapp: whatsapp,
      email: email,
      instagram: instagram,
      cidade: cidade,
      horario: horario,
      siteUrl: siteUrl,
      services: services
    }
  };
}

function serialize(cfg) {
  var data = {
    whatsapp: cfg.whatsapp || "",
    email: cfg.email || "",
    instagram: cfg.instagram || "",
    cidade: cfg.cidade || "",
    horario: cfg.horario || "",
    siteUrl: cfg.siteUrl || "",
    services: cfg.services.map(function (service) {
      return {
        id: service.id,
        name: service.name,
        price: Math.round(Number(service.price) || 0),
        prazo: service.prazo
      };
    })
  };
  return [
    "/* NEXORA — configuração publicada.",
    "   Substitua o arquivo js/config.js por este e publique de novo na Netlify (plano gratuito).",
    "   whatsapp: somente números, com DDI 55 e DDD. Exemplo: 5511987654321",
    "   siteUrl: endereço final, sem barra no fim. Exemplo: https://seu-site.netlify.app",
    "   Deixe vazio o que ainda não tiver.",
    "*/",
    "export const NEXORA_CONFIG = " + JSON.stringify(data, null, 2) + ";",
    ""
  ].join("\n");
}

function downloadConfig(cfg) {
  var blob = new Blob([serialize(cfg)], { type: "text/javascript;charset=utf-8" });
  var url = URL.createObjectURL(blob);
  var anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = "config.js";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(function () {
    URL.revokeObjectURL(url);
  }, 1000);
}

function saveEditor(form) {
  var result = readEditor(form);
  var status = document.getElementById("editor-status");
  if (result.errors.length) {
    showStatus(status, result.errors[0]);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(result.cfg));
  editing = true;
  apply(activeConfig());
  showStatus(
    status,
    result.cfg.whatsapp
      ? "Salvo neste navegador. Baixe o config.js e publique de novo para os visitantes verem os mesmos dados."
      : "Salvo neste navegador, ainda sem WhatsApp. Os botões de contratação não abrem conversa enquanto o número estiver vazio."
  );
}

function submitQuote(form) {
  clearFieldErrors(form);
  var nome = valueOf(form, "nome").trim();
  var telefone = valueOf(form, "telefone").trim();
  var email = valueOf(form, "email").trim();
  var servico = valueOf(form, "servico").trim();
  var quando = valueOf(form, "quando").trim();
  var descricao = valueOf(form, "descricao").trim();
  var invalid = false;

  function fail(name, message) {
    if (!invalid) {
      var field = form.elements.namedItem(name);
      if (field && "focus" in field) field.focus();
    }
    invalid = true;
    setFieldError(form, name, message);
  }

  if (nome.length < 2) fail("nome", "Informe seu nome.");
  if (telefone.replace(/\D/g, "").length < 10) fail("telefone", "Informe um WhatsApp ou telefone com DDD.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail("email", "Informe um e-mail válido.");
  if (!servico) fail("servico", "Escolha um serviço.");
  if (descricao.length < 20) fail("descricao", "Descreva o projeto em pelo menos uma frase (20 caracteres).");
  if (invalid) return;

  var status = document.getElementById("form-status");
  var service = serviceById(servico);
  var message = [
    "Olá, NEXORA. Quero solicitar um orçamento.",
    "",
    "Serviço: " + (service ? service.name : servico),
    service ? "Valor inicial exibido na página: " + money(service.price) + "." : null,
    "O valor oficial depende do escopo e precisa ser confirmado nesta conversa.",
    "",
    "Nome: " + nome,
    "WhatsApp: " + telefone,
    "E-mail: " + email,
    quando ? "Necessidade: " + quando : null,
    "",
    "Sobre o projeto:",
    descricao
  ].filter(function (line) { return line !== null; }).join("\n");

  var url = waUrl(current || activeConfig(), message);
  if (!url) {
    showStatus(status, "O WhatsApp da NEXORA ainda não foi publicado, então este pedido não saiu do formulário.", {
      href: "/precos#editar",
      label: "Configurar WhatsApp"
    });
    return;
  }

  var popup = window.open(url, "_blank");
  if (popup) popup.opener = null;
  showStatus(
    status,
    popup
      ? "O WhatsApp abriu com a sua mensagem. Envie a conversa para concluir o pedido. Se a janela não apareceu,"
      : "O navegador bloqueou a nova aba. Nada foi enviado ainda.",
    { href: url, label: "abrir WhatsApp manualmente", external: true }
  );
}

function closeNav() {
  var nav = document.getElementById("site-nav");
  var toggle = document.querySelector("[data-nav-toggle]");
  if (nav) nav.classList.remove("is-open");
  if (toggle) {
    toggle.setAttribute("aria-expanded", "false");
    toggle.textContent = "Menu";
  }
}

function onClick(event) {
  var target = event.target;
  if (!(target instanceof Element)) return;

  var toggle = target.closest("[data-nav-toggle]");
  if (toggle) {
    var nav = document.getElementById("site-nav");
    if (!nav) return;
    var open = !nav.classList.contains("is-open");
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    toggle.textContent = open ? "Fechar" : "Menu";
    return;
  }

  if (target.closest("#site-nav a")) closeNav();

  if (target.closest("[data-edit-toggle]")) {
    editing = !editing;
    apply(current || activeConfig());
    if (editing) {
      var first = document.getElementById("owner-whatsapp");
      if (first) first.focus();
    }
    return;
  }

  if (target.closest("[data-restore-config]")) {
    localStorage.removeItem(STORAGE_KEY);
    editing = true;
    apply(activeConfig());
    showStatus(document.getElementById("editor-status"), "Valores publicados restaurados neste navegador.");
    return;
  }

  if (target.closest("[data-download-config]")) {
    var form = document.getElementById("price-editor");
    var status = document.getElementById("editor-status");
    var cfg = current || activeConfig();
    if (form) {
      var result = readEditor(form);
      if (result.errors.length) {
        showStatus(status, result.errors[0]);
        return;
      }
      cfg = result.cfg;
    }
    downloadConfig(cfg);
    showStatus(status, "config.js baixado. Substitua js/config.js na pasta do site e publique de novo. Para pré-visualizar aqui, salve neste navegador.");
  }
}

function onSubmit(event) {
  var form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  if (form.id === "quote-form") {
    event.preventDefault();
    submitQuote(form);
  } else if (form.id === "price-editor") {
    event.preventDefault();
    saveEditor(form);
  }
}

function onChange(event) {
  var target = event.target;
  if (target instanceof HTMLSelectElement && target.id === "servico") updateServiceMeta();
}

function onKey(event) {
  if (event.key === "Escape") closeNav();
}

function onHash() {
  if (window.location.hash === "#editar" && document.getElementById("price-editor")) {
    editing = true;
    apply(current || activeConfig());
  }
}

function ensureBound() {
  if (bound) return;
  bound = true;
  document.addEventListener("click", onClick);
  document.addEventListener("submit", onSubmit);
  document.addEventListener("change", onChange);
  document.addEventListener("keydown", onKey);
  window.addEventListener("hashchange", onHash);
}

export function initNexora() {
  if (typeof document === "undefined") return;
  if (!document.querySelector("[data-nexora]")) return;
  ensureBound();
  editing = window.location.hash === "#editar" && !!document.getElementById("price-editor");
  apply(activeConfig());
}
