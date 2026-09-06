/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.0.0
   Módulo: Extrator Inteligente de Metadados por Link de Lojas Virtuais
   ========================================================================== */

const LinkExtractor = {
  /**
   * Extrai dados de um produto a partir da sua URL
   * @param {string} url - URL do produto
   * @returns {Promise<{title: string, imageUrl: string, price: number, description: string, productUrl: string, sourceStore: string}>}
   */
  async extractFromUrl(url) {
    if (!url || !url.trim().startsWith('http')) {
      throw new Error('Por favor, informe uma URL válida iniciando com http:// ou https://');
    }

    url = url.trim();
    const domain = this._getDomainName(url);
    const fallbackData = {
      title: '',
      imageUrl: '',
      price: 0,
      description: `Produto selecionado da loja ${domain}`,
      productUrl: url,
      sourceStore: domain
    };

    // Tentar buscar HTML via proxies CORS conhecidos
    const html = await this._fetchHtmlWithFallbacks(url);
    if (!html) {
      // Se todos os proxies falharem, retorna dados base para preenchimento manual
      return fallbackData;
    }

    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // 1. Extração do Título
      let title = this._extractTitle(doc, url);

      // 2. Extração da Imagem
      let imageUrl = this._extractImage(doc, url);

      // 3. Extração do Preço
      let price = this._extractPrice(doc, html);

      // 4. Extração da Descrição
      let description = this._extractDescription(doc) || fallbackData.description;

      return {
        title: title || fallbackData.title,
        imageUrl: imageUrl || '',
        price: price || 0,
        description: description,
        productUrl: url,
        sourceStore: domain
      };
    } catch (err) {
      console.warn('[LinkExtractor] Erro ao analisar HTML:', err);
      return fallbackData;
    }
  },

  async _fetchHtmlWithFallbacks(url) {
    const proxies = [
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
      `https://corsproxy.io/?url=${encodeURIComponent(url)}`,
      `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`
    ];

    for (const proxyUrl of proxies) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 7000);

        const response = await fetch(proxyUrl, {
          signal: controller.signal,
          headers: { 'Accept': 'text/html,application/xhtml+xml,application/xml' }
        });
        clearTimeout(timeoutId);

        if (response.ok) {
          const text = await response.text();
          if (text && text.length > 300) {
            return text;
          }
        }
      } catch (e) {
        // Tenta o próximo proxy
      }
    }
    return null;
  },

  _extractTitle(doc, url) {
    // 1. Tags OpenGraph / Twitter
    const ogTitle = doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
                    doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content') ||
                    doc.querySelector('meta[name="title"]')?.getAttribute('content');

    if (ogTitle && ogTitle.trim()) {
      return this._cleanTitle(ogTitle);
    }

    // 2. Elementos DOM específicos de lojas
    const domSelectors = [
      '#productTitle',                    // Amazon
      '.ui-pdp-title',                    // Mercado Livre
      '[data-testid="heading-product-title"]', // Magalu
      'h1.product-title',
      'h1.header-product__title',
      'h1'
    ];

    for (const sel of domSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent.trim()) {
        return this._cleanTitle(el.textContent.trim());
      }
    }

    // 3. Tag <title>
    const pageTitle = doc.title;
    if (pageTitle) {
      return this._cleanTitle(pageTitle);
    }

    return '';
  },

  _cleanTitle(rawTitle) {
    if (!rawTitle) return '';
    // Remover sufixos comerciais comuns
    return rawTitle
      .replace(/\s*\|\s*(Mercado Livre|Amazon\.com\.br|Magazine Luiza|Casas Bahia|Shopee).*$/i, '')
      .replace(/\s*-\s*(Mercado Livre|Amazon\.com\.br|Magazine Luiza|Casas Bahia|Shopee).*$/i, '')
      .trim();
  },

  _extractImage(doc, baseUrl) {
    // 1. Metatags OpenGraph / Twitter
    const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content') ||
                    doc.querySelector('meta[property="og:image:secure_url"]')?.getAttribute('content') ||
                    doc.querySelector('meta[name="twitter:image"]')?.getAttribute('content') ||
                    doc.querySelector('meta[itemprop="image"]')?.getAttribute('content');

    if (ogImage && ogImage.trim()) {
      return this._resolveUrl(ogImage.trim(), baseUrl);
    }

    // 2. Seletores específicos de grandes varejistas
    const domSelectors = [
      '#landingImage',                   // Amazon
      '.ui-pdp-image',                   // Mercado Livre
      '[data-testid="image-selected"]',  // Magalu
      '.photos-container img',
      '.product-image img',
      'img[src*="product"]',
      'img[src*="foto"]'
    ];

    for (const sel of domSelectors) {
      const el = doc.querySelector(sel);
      const src = el?.getAttribute('src') || el?.getAttribute('data-src') || el?.getAttribute('data-zoom-image');
      if (src && !src.includes('data:image/svg')) {
        return this._resolveUrl(src.trim(), baseUrl);
      }
    }

    return '';
  },

  _extractPrice(doc, rawHtml) {
    // 1. Metatags OpenGraph de Preço
    const metaPrice = doc.querySelector('meta[property="product:price:amount"]')?.getAttribute('content') ||
                      doc.querySelector('meta[property="og:price:amount"]')?.getAttribute('content') ||
                      doc.querySelector('meta[itemprop="price"]')?.getAttribute('content');

    if (metaPrice) {
      const parsed = parseFloat(metaPrice.replace(',', '.'));
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }

    // 2. Microdados JSON-LD (Schema.org)
    const jsonLdScripts = doc.querySelectorAll('script[type="application/ld+json"]');
    for (const script of jsonLdScripts) {
      try {
        const json = JSON.parse(script.textContent);
        const price = this._findPriceInJson(json);
        if (price > 0) return price;
      } catch (e) {}
    }

    // 3. Seletores de preço em lojas comuns
    const priceSelectors = [
      '.a-price .a-offscreen',           // Amazon
      '.ui-pdp-price__second-line .andes-money-amount__fraction', // Mercado Livre
      '[data-testid="price-default"]',   // Magalu
      '.price-value',
      '.sales-price',
      '.product-price'
    ];

    for (const sel of priceSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.textContent) {
        const cleaned = this._parsePriceString(el.textContent);
        if (cleaned > 0) return cleaned;
      }
    }

    // 4. Regex de Real no HTML
    const priceMatch = rawHtml.match(/R\$\s?([0-9]{1,3}(?:\.[0-9]{3})*(?:,[0-9]{2}))/i);
    if (priceMatch && priceMatch[1]) {
      return this._parsePriceString(priceMatch[1]);
    }

    return 0;
  },

  _findPriceInJson(obj) {
    if (!obj || typeof obj !== 'object') return 0;

    if (obj.offers) {
      const offers = Array.isArray(obj.offers) ? obj.offers[0] : obj.offers;
      if (offers && offers.price) {
        const p = parseFloat(String(offers.price).replace(',', '.'));
        if (!isNaN(p) && p > 0) return p;
      }
      if (offers && offers.lowPrice) {
        const p = parseFloat(String(offers.lowPrice).replace(',', '.'));
        if (!isNaN(p) && p > 0) return p;
      }
    }

    if (obj.price) {
      const p = parseFloat(String(obj.price).replace(',', '.'));
      if (!isNaN(p) && p > 0) return p;
    }

    return 0;
  },

  _parsePriceString(str) {
    if (!str) return 0;
    // Extrai números e vírgula
    const cleaned = str.replace(/[^\d,\.]/g, '');
    if (cleaned.includes(',') && cleaned.includes('.')) {
      // Formato brasileiro: 1.250,50
      return parseFloat(cleaned.replace(/\./g, '').replace(',', '.')) || 0;
    } else if (cleaned.includes(',')) {
      return parseFloat(cleaned.replace(',', '.')) || 0;
    } else {
      return parseFloat(cleaned) || 0;
    }
  },

  _extractDescription(doc) {
    const desc = doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
                 doc.querySelector('meta[name="description"]')?.getAttribute('content');
    return desc ? desc.trim().substring(0, 200) : '';
  },

  _resolveUrl(relativeUrl, baseUrl) {
    try {
      return new URL(relativeUrl, baseUrl).href;
    } catch (e) {
      return relativeUrl;
    }
  },

  _getDomainName(url) {
    try {
      const hostname = new URL(url).hostname;
      return hostname.replace(/^www\./, '');
    } catch (e) {
      return 'Loja';
    }
  }
};

window.LinkExtractor = LinkExtractor;
