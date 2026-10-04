import "./index.css";

import schema from "./schema.json" with { type: "json" };

const app = document.querySelector("#app");
const sidebar = document.querySelector("#sidebar");
const title = document.querySelector("#title");
const subtitle = document.querySelector("#subtitle");
const themeToggle = document.querySelector("#theme-toggle");

const stored = localStorage.getItem("api-reference-theme");

const theme = stored === "light" || stored === "dark" ? stored : globalThis.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";

document.documentElement.dataset.theme = theme;

const schemas = schema.components?.schemas ?? {};
const methods = schema.methods ?? [];

const schemaEntries = Object.entries(schemas);

let scrollSpyTargets = [];
let scrollSpyTicking = false;
let activeSectionId = null;
let isProgrammaticScroll = false;
let programmaticScrollTimer = null;

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function schemaId(name) {
  return `schema-${slug(name)}`;
}

function methodId(name) {
  return `method-${slug(name)}`;
}

function refName(ref) {
  if (!ref) return "";
  return ref.split("/").filter(Boolean).pop() ?? ref;
}

function typeOf(schema) {
  if (!schema) return "unknown";
  if (schema.$ref) return refName(schema.$ref);

  if (schema.type === "array") {
    if (!schema.items) return "array";
    return `array<${typeOf(schema.items)}>`;
  }

  if (Array.isArray(schema.type)) {
    return schema.type.join(" | ");
  }

  if (schema.enum) return "enum";
  if (schema.type) return schema.type;
  if (schema.properties) return "object";

  return "unknown";
}

function isExpandable(schema) {
  return Boolean(
    schema?.properties ||
    (schema?.type === "array" && schema?.items)
  );
}

function isRequired(parentSchema, name) {
  return (
    Array.isArray(parentSchema?.required) &&
    parentSchema.required.includes(name)
  );
}

function findSchema(name) {
  return schemas[name];
}

function refLink(ref, className = "") {
  const name = refName(ref);

  if (!name) return "";

  if (!findSchema(name)) {
    return `
      <span class="type-link type-link-muted ${className}">
        ${esc(name)}
      </span>
    `;
  }

  return `
    <a
      class="type-link ${className}"
      href="#${schemaId(name)}"
      data-ref="${esc(name)}"
    >
      ${esc(name)}
    </a>
  `;
}

function typeHtml(schema) {
  if (!schema) {
    return `<span class="type-value">unknown</span>`;
  }

  if (schema.$ref) {
    return refLink(schema.$ref);
  }

  if (schema.type === "array") {
    const item = schema.items;

    if (!item) {
      return `<span class="type-value">array</span>`;
    }

    if (item.$ref) {
      return `
        <span class="type-value">
          array&lt;${refLink(item.$ref)}&gt;
        </span>
      `;
    }

    return `
      <span class="type-value">
        array&lt;<span>${esc(typeOf(item))}</span>&gt;
      </span>
    `;
  }

  return `<span class="type-value">${esc(typeOf(schema))}</span>`;
}

function enumHtml(schema) {
  if (!Array.isArray(schema?.enum) || schema.enum.length === 0) {
    return "";
  }

  return `
    <div class="enum-block">
      <div class="detail-label">Allowed values</div>
      <div class="enum-values">
        ${schema.enum.map((value) => `<code>${esc(value)}</code>`).join("")}
      </div>
    </div>
  `;
}

function descriptionHtml(description) {
  if (!description) return "";

  return `
    <div class="description">
      ${esc(description)}
    </div>
  `;
}

function renderArrayDetails(schema) {
  if (schema?.type !== "array" || !schema.items) {
    return "";
  }

  const item = schema.items;

  return `
    <div class="array-detail">
      <div class="array-detail-header">
        <span class="detail-label">Array items</span>
        <span class="array-signature">
          array&lt;${typeHtml(item)}&gt;
        </span>
      </div>

      ${
        item.$ref
          ? `
            <div class="array-reference">
              <span class="detail-label">Schema</span>
              ${refLink(item.$ref)}
            </div>
          `
          : ""
      }

      ${
        item.properties
          ? `
            <div class="nested-properties">
              ${Object.entries(item.properties)
                .map(([name, child]) =>
                  renderProperty(name, child, isRequired(item, name), true)
                )
                .join("")}
            </div>
          `
          : ""
      }

      ${enumHtml(item)}
    </div>
  `;
}

function renderProperty(name, schema, required = false, nested = false) {
  const expandable = isExpandable(schema);

  const propertyId =
    `${nested ? "nested" : "property"}-${slug(name)}-` +
    `${Math.random().toString(36).slice(2, 8)}`;

  return `
    <div
      class="property ${expandable ? "property-expandable" : ""}"
      data-property="${esc(name)}"
    >
      <div class="property-main">
        ${
          expandable
            ? `
              <button
                class="property-toggle"
                type="button"
                aria-expanded="false"
                aria-controls="${propertyId}"
              >
                <span class="chevron"></span>
              </button>
            `
            : `
              <span class="property-toggle-spacer"></span>
            `
        }

        <div class="property-content">
          <div class="property-header">
            <code class="property-name">${esc(name)}</code>
            ${required ? `<span class="required-badge">required</span>` : ""}
            <span class="property-type">${typeHtml(schema)}</span>
          </div>

          ${descriptionHtml(schema.description)}
        </div>
      </div>

      ${
        expandable
          ? `
            <div class="property-children" id="${propertyId}" hidden>
              ${
                schema.properties
                  ? `
                    <div class="nested-properties">
                      ${Object.entries(schema.properties)
                        .map(([childName, childSchema]) =>
                          renderProperty(
                            childName,
                            childSchema,
                            isRequired(schema, childName),
                            true
                          )
                        )
                        .join("")}
                    </div>
                  `
                  : ""
              }

              ${renderArrayDetails(schema)}
              ${enumHtml(schema)}
            </div>
          `
          : enumHtml(schema)
      }
    </div>
  `;
}

function renderSchema(name, schema) {
  const properties = Object.entries(schema?.properties ?? {});

  return `
    <section
      class="schema-card"
      id="${schemaId(name)}"
      data-schema-name="${esc(name)}"
    >
      <div class="schema-card-header">
        <div>
          <div class="eyebrow">SCHEMA</div>
          <h2 class="schema-title">${esc(name)}</h2>

          ${
            schema.description
              ? `<p class="schema-description">${esc(schema.description)}</p>`
              : ""
          }
        </div>

        <div class="schema-type-badge">${esc(typeOf(schema))}</div>
      </div>

      ${
        properties.length
          ? `
            <div class="schema-properties">
              <div class="section-heading">
                <span>Properties</span>
                <span class="section-count">${properties.length}</span>
              </div>

              <div class="property-list">
                ${properties
                  .map(([propertyName, propertySchema]) =>
                    renderProperty(
                      propertyName,
                      propertySchema,
                      isRequired(schema, propertyName)
                    )
                  )
                  .join("")}
              </div>
            </div>
          `
          : `
            <div class="schema-body">
              ${enumHtml(schema)}
              ${schema.type === "array" ? renderArrayDetails(schema) : ""}
            </div>
          `
      }
    </section>
  `;
}

function renderParameter(name, schema, required = false) {
  return `
    <div class="method-parameter">
      <div class="parameter-name">
        <code>${esc(name)}</code>
        ${required ? `<span class="required-badge">required</span>` : ""}
      </div>

      <div class="parameter-type">${typeHtml(schema)}</div>

      ${
        schema.description
          ? `<div class="parameter-description">${esc(schema.description)}</div>`
          : ""
      }
    </div>
  `;
}

function renderMethod(method) {
  const name = method.name ?? "Unnamed method";
  const params = method.params ?? [];
  const result = method.result;

  return `
    <section
      class="method-card"
      id="${methodId(name)}"
      data-method-name="${esc(name)}"
    >
      <div class="method-card-header">
        <div class="method-heading">
          <div class="method-kind">METHOD</div>
          <h2 class="method-title">${esc(name)}</h2>
        </div>
      </div>

      ${
        method.description
          ? `<div class="method-description">${esc(method.description)}</div>`
          : ""
      }

      <div class="method-sections">
        <section class="method-section">
          <div class="method-section-header">
            <div class="method-section-title">Parameters</div>
            <span class="section-count">${params.length}</span>
          </div>

          ${
            params.length
              ? `
                <div class="parameter-list">
                  ${params
                    .map((param) =>
                      renderParameter(
                        param.name ?? "parameter",
                        param.schema,
                        param.required === true
                      )
                    )
                    .join("")}
                </div>
              `
              : `
                <div class="empty-state">
                  This method does not require parameters.
                </div>
              `
          }
        </section>

        <section class="method-section">
          <div class="method-section-header">
            <div class="method-section-title">Returns</div>
          </div>

          ${
            result
              ? `
                <div class="result-row">
                  <div class="result-name">
                    <code>${esc(result.name ?? "result")}</code>
                  </div>

                  <div class="result-type">${typeHtml(result.schema)}</div>

                  ${
                    result.description
                      ? `<div class="result-description">${esc(result.description)}</div>`
                      : ""
                  }
                </div>
              `
              : `
                <div class="empty-state">
                  This method does not define a result.
                </div>
              `
          }
        </section>
      </div>
    </section>
  `;
}

function renderSidebar() {
  sidebar.innerHTML = `
    <nav class="sidebar-nav" aria-label="API navigation">
      <div class="sidebar-search">
        <label class="search-box" for="sidebar-search-input">
          <span class="search-icon" aria-hidden="true"></span>

          <input
            id="sidebar-search-input"
            class="sidebar-search-input"
            type="search"
            placeholder="Search methods & schemas…"
            autocomplete="off"
            spellcheck="false"
          />

          <kbd class="search-shortcut">/</kbd>
        </label>

        <div
          class="search-results-count"
          id="search-results-count"
        ></div>
      </div>

      <!--
        Only this wrapper is the sidebar's scroll area.
        The search field stays outside it and therefore remains
        permanently visible without being sticky.
      -->
      <div class="sidebar-scroll">
        <div class="sidebar-groups">
          <div class="sidebar-group" data-sidebar-group="methods">
            <div class="sidebar-group-header">
              <span>METHODS</span>
              <span class="sidebar-count">${methods.length}</span>
            </div>

            <div class="sidebar-list">
              ${methods
                .map((method) => {
                  const name = method.name ?? "Unnamed method";

                  return `
                    <a
                      class="sidebar-link sidebar-method-link"
                      href="#${methodId(name)}"
                      data-target="${methodId(name)}"
                      data-search-name="${esc(name)}"
                      data-search-description="${esc(method.description ?? "")}"
                    >
                      <span>${esc(name)}</span>
                    </a>
                  `;
                })
                .join("")}
            </div>
          </div>

          <div class="sidebar-group" data-sidebar-group="schemas">
            <div class="sidebar-group-header">
              <span>COMPONENTS / SCHEMAS</span>
              <span class="sidebar-count">${schemaEntries.length}</span>
            </div>

            <div class="sidebar-list">
              ${schemaEntries
                .map(
                  ([name, schema]) => `
                    <a
                      class="sidebar-link sidebar-schema-link"
                      href="#${schemaId(name)}"
                      data-target="${schemaId(name)}"
                      data-search-name="${esc(name)}"
                      data-search-description="${esc(schema.description ?? "")}"
                    >
                      <span>${esc(name)}</span>
                    </a>
                  `
                )
                .join("")}
            </div>
          </div>
        </div>

        <div
          class="sidebar-search-empty"
          id="sidebar-search-empty"
          hidden
        >
          <div class="search-empty-title">No results</div>
          <div class="search-empty-description">
            Try another method or schema name.
          </div>
        </div>
      </div>
    </nav>
  `;

  setupSidebarSearch();
}

function renderMain() {
  app.innerHTML = `
    <div class="content">
      <div class="page-intro">
        <div class="eyebrow">OPENRPC API REFERENCE</div>

        <h1>${esc(schema.info?.title ?? "API Reference")}</h1>

        ${
          schema.info?.description
            ? `<p>${esc(schema.info.description)}</p>`
            : ""
        }

        <div class="intro-meta">
          ${
            schema.info?.version
              ? `
                <span>
                  <strong>Version</strong>
                  ${esc(schema.info.version)}
                </span>
              `
              : ""
          }

          <span><strong>Methods</strong> ${methods.length}</span>
          <span><strong>Schemas</strong> ${schemaEntries.length}</span>
        </div>
      </div>

      <section class="content-section" id="methods">
        <div class="content-section-header">
          <div>
            <div class="eyebrow">REFERENCE</div>
            <h2>Methods</h2>
          </div>

          <span class="section-count large">${methods.length}</span>
        </div>

        <div class="method-list">
          ${methods.map(renderMethod).join("")}
        </div>
      </section>

      <section class="content-section" id="schemas">
        <div class="content-section-header">
          <div>
            <div class="eyebrow">REFERENCE</div>
            <h2>Components / Schemas</h2>
          </div>

          <span class="section-count large">${schemaEntries.length}</span>
        </div>

        <div class="schema-list">
          ${schemaEntries
            .map(([name, schema]) => renderSchema(name, schema))
            .join("")}
        </div>
      </section>
    </div>
  `;
}

function setupSidebarSearch() {
  const input = document.querySelector("#sidebar-search-input");
  const count = document.querySelector("#search-results-count");
  const empty = document.querySelector("#sidebar-search-empty");

  if (!input) return;

  const links = [...document.querySelectorAll(".sidebar-link")];
  const groups = [...document.querySelectorAll(".sidebar-group")];

  function updateSearch() {
    const query = input.value.trim().toLowerCase();
    let visibleCount = 0;

    links.forEach((link) => {
      const name = (link.dataset.searchName ?? "").toLowerCase();
      const description =
        (link.dataset.searchDescription ?? "").toLowerCase();

      const matches =
        !query ||
        name.includes(query) ||
        description.includes(query);

      link.style.display = matches ? "" : "none";

      if (matches) visibleCount++;
    });

    groups.forEach((group) => {
      const visibleLinks = [...group.querySelectorAll(".sidebar-link")]
        .filter((link) => link.style.display !== "none");

      group.style.display = visibleLinks.length > 0 ? "" : "none";
    });

    empty.style.display =
      query && visibleCount === 0 ? "" : "none";

    count.textContent =
      !query
        ? ""
        : visibleCount === 1
          ? "1 result"
          : `${visibleCount} results`;
  }

  input.addEventListener("input", updateSearch);

  input.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      input.value = "";
      updateSearch();
      input.blur();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (
      event.key === "/" &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey &&
      document.activeElement !== input &&
      !["INPUT", "TEXTAREA", "SELECT"].includes(
        document.activeElement?.tagName
      )
    ) {
      event.preventDefault();
      input.focus();
      input.select();
    }
  });
}

function setupExpandableProperties() {
  document.querySelectorAll(".property-toggle").forEach((button) => {
    button.addEventListener("click", () => {
      const targetId = button.getAttribute("aria-controls");
      const target = document.getElementById(targetId);

      if (!target) return;

      const expanded =
        button.getAttribute("aria-expanded") === "true";

      button.setAttribute(
        "aria-expanded",
        String(!expanded)
      );

      target.hidden = expanded;

      button
        .closest(".property")
        ?.classList.toggle("is-open", !expanded);
    });
  });
}

function setHash(id, replace = false) {
  const method = replace ? "replaceState" : "pushState";

  history[method](null, "", `#${id}`);
}

function getScrollTargetPosition(target) {
  const headerHeight =
    document.querySelector(".site-header")?.offsetHeight ?? 0;

  const topGap = 24;

  return Math.max(
    0,
    globalThis.scrollY +
      target.getBoundingClientRect().top -
      headerHeight -
      topGap
  );
}

function scrollToTarget(target, behavior = "smooth") {
  if (!target) return;

  isProgrammaticScroll = true;

  if (programmaticScrollTimer) {
    globalThis.clearTimeout(programmaticScrollTimer);
  }

  globalThis.scrollTo({
    top: getScrollTargetPosition(target),
    behavior
  });

  programmaticScrollTimer = globalThis.setTimeout(
    () => {
      isProgrammaticScroll = false;
      requestScrollSpyUpdate();
    },
    behavior === "smooth" ? 700 : 50
  );
}

function setupRefLinks() {
  document.querySelectorAll("[data-ref]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const name = link.dataset.ref;
      const target = document.getElementById(schemaId(name));

      if (!target) return;

      event.preventDefault();

      setHash(target.id);
      setActiveSidebarItem(target.id);
      scrollToTarget(target);

      target.classList.add("is-highlighted");

      globalThis.setTimeout(
        () => target.classList.remove("is-highlighted"),
        1200
      );
    });
  });
}

function updateScrollSpy() {
  scrollSpyTicking = false;

  if (!scrollSpyTargets.length || isProgrammaticScroll) {
    return;
  }

  const headerHeight =
    document.querySelector(".site-header")?.offsetHeight ?? 0;

  const activationLine =
    globalThis.scrollY + headerHeight + 32;

  let current = scrollSpyTargets[0];

  for (const target of scrollSpyTargets) {
    const absoluteTop =
      globalThis.scrollY +
      target.getBoundingClientRect().top;

    if (absoluteTop <= activationLine) {
      current = target;
    } else {
      break;
    }
  }

  if (!current) return;

  if (current.id !== activeSectionId) {
    setActiveSidebarItem(current.id);

    const currentHash =
      globalThis.location.hash.slice(1);

    if (currentHash !== current.id) {
      setHash(current.id, true);
    }
  }
}

function requestScrollSpyUpdate() {
  if (scrollSpyTicking) return;

  scrollSpyTicking = true;
  globalThis.requestAnimationFrame(updateScrollSpy);
}

function setActiveSidebarItem(targetId) {
  activeSectionId = targetId;

  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle(
      "is-active",
      link.dataset.target === targetId
    );
  });

  const activeLink = document.querySelector(
    `.sidebar-link[data-target="${CSS.escape(targetId)}"]`
  );

  if (activeLink) {
    activeLink.scrollIntoView({
      block: "nearest"
    });
  }
}

function setupScrollSpy() {
  scrollSpyTargets = [
    ...methods.map((method) =>
      document.getElementById(methodId(method.name))
    ),
    ...schemaEntries.map(([name]) =>
      document.getElementById(schemaId(name))
    )
  ].filter(Boolean);

  globalThis.addEventListener(
    "scroll",
    requestScrollSpyUpdate,
    { passive: true }
  );

  globalThis.addEventListener(
    "resize",
    requestScrollSpyUpdate,
    { passive: true }
  );

  requestScrollSpyUpdate();
}

function setupSidebarLinks() {
  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", (event) => {
      const targetId = link.dataset.target;
      const target = document.getElementById(targetId);

      if (!target) return;

      event.preventDefault();

      setHash(targetId);
      setActiveSidebarItem(targetId);
      scrollToTarget(target);
    });
  });
}

function scrollToInitialHash() {
  const hash = globalThis.location.hash.slice(1);

  if (!hash) {
    requestScrollSpyUpdate();
    return;
  }

  const target = document.getElementById(hash);

  if (!target) {
    requestScrollSpyUpdate();
    return;
  }

  setActiveSidebarItem(hash);

  globalThis.requestAnimationFrame(() => {
    globalThis.requestAnimationFrame(() => {
      scrollToTarget(target, "auto");

      globalThis.setTimeout(() => {
        isProgrammaticScroll = false;
        setActiveSidebarItem(hash);
      }, 60);
    });
  });
}

function setupHashNavigation() {
  globalThis.addEventListener("hashchange", () => {
    const hash = globalThis.location.hash.slice(1);

    if (!hash) return;

    const target = document.getElementById(hash);

    if (!target) return;

    setActiveSidebarItem(hash);
    scrollToTarget(target);
  });
}

function getPreferredTheme() {
  const stored =
    localStorage.getItem("api-reference-theme");

  if (stored === "light" || stored === "dark") {
    return stored;
  }

  return globalThis.matchMedia(
    "(prefers-color-scheme: dark)"
  ).matches
    ? "dark"
    : "light";
}

function updateThemeButton() {
  if (!themeToggle) return;

  const dark =
    document.documentElement.dataset.theme === "dark";

  themeToggle.setAttribute(
    "aria-label",
    dark ? "Switch to light mode" : "Switch to dark mode"
  );

  themeToggle.setAttribute(
    "title",
    dark ? "Switch to light mode" : "Switch to dark mode"
  );

  themeToggle.innerHTML = dark
    ? `
      <span class="theme-icon theme-icon-sun" aria-hidden="true">☼</span>
      <span class="theme-label">Light</span>
    `
    : `
      <span class="theme-icon theme-icon-moon" aria-hidden="true">◐</span>
      <span class="theme-label">Dark</span>
    `;
}

function setupTheme() {
  const theme = getPreferredTheme();

  document.documentElement.dataset.theme = theme;
  updateThemeButton();

  if (!themeToggle) return;

  themeToggle.addEventListener("click", () => {
    const current =
      document.documentElement.dataset.theme;

    const next =
      current === "dark" ? "light" : "dark";

    document.documentElement.dataset.theme = next;

    localStorage.setItem(
      "api-reference-theme",
      next
    );

    updateThemeButton();
  });
}

function initialize() {
  title.textContent =
    schema.info?.title ?? "OpenRPC API Reference";

  subtitle.textContent = [
    schema.info?.version
      ? `v${schema.info.version}`
      : null,
    `${methods.length} methods`,
    `${schemaEntries.length} schemas`
  ]
    .filter(Boolean)
    .join(" · ");

  renderSidebar();
  renderMain();

  setupTheme();
  setupExpandableProperties();
  setupRefLinks();
  setupSidebarLinks();
  setupScrollSpy();
  setupHashNavigation();

  scrollToInitialHash();
}

try {
  initialize();
} catch (error) {
  console.error(error);

  app.innerHTML = `
    <div class="error-card">
      <h2>Unable to render API reference</h2>
      <p>${esc(error.message)}</p>
    </div>
  `;
}
