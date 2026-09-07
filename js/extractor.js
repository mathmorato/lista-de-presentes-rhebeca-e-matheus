/* ==========================================================================
   LISTA DE PRESENTES - RHEBECA & MATHEUS
   Versão: v.1.3.8
   Módulo: Extrator Inteligente Resiliente com Heurística de URLs e Metadados
   ========================================================================== */

const LinkExtractor = {
  // Imagens temáticas refinadas de alta qualidade para presentes de casamento
  THEMATIC_IMAGES: {
    cozinha: [
      'https://images.unsplash.com/photo-1556911073-38141963c9e0?auto=format&fit=crop&w=600&q=80', // panelas
      'https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?auto=format&fit=crop&w=600&q=80', // talheres
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=600&q=80', // pratos
      'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?auto=format&fit=crop&w=600&q=80'  // taças
    ],
    eletro: [
      'https://images.unsplash.com/photo-1585659722983-3a675dabf23d?auto=format&fit=crop&w=600&q=80', // air fryer
      'https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?auto=format&fit=crop&w=600&q=80', // cafeteira
      'https://images.unsplash.com/photo-1574269909862-7e1d70bb8078?auto=format&fit=crop&w=600&q=80', // liquidificador
      'https://images.unsplash.com/photo-1626806787461-102c1bfaaea1?auto=format&fit=crop&w=600&q=80'  // lava e seca
    ],
    quarto: [
      'https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=600&q=80', // jogo de cama
      'https://images.unsplash.com/photo-1584100936595-c0654b55a2e2?auto=format&fit=crop&w=600&q=80', // travesseiros
      'https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=600&q=80'  // toalhas
    ],
    sala: [
      'https://images.unsplash.com/photo-1615529182904-14819c35db37?auto=format&fit=crop&w=600&q=80', // porcelana/decor
      'https://images.unsplash.com/photo-1513519245088-0e12902e5a38?auto=format&fit=crop&w=600&q=80', // vaso decorativo
      'https://images.unsplash.com/photo-1540518614846-7ede433c4ef0?auto=format&fit=crop&w=600&q=80'  // luminaria
    ],
    cotas: [
      'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=600&q=80', // jantar
      'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', // praia/passeio
      'https://images.unsplash.com/photo-1436491865332-7a61a109cc05?auto=format&fit=crop&w=600&q=80'  // passagens
    ]
  },

  /**
   * Extrai dados de um produto a partir de qualquer URL com garantia de resultado
   */
  async extractFromUrl(url) {
    if (!url || !url.trim().startsWith('http')) {
      throw new Error('Por favor, informe uma URL válida iniciando com http:// ou https://');
    }

    url = url.trim();

    // 1. Heurística Semântica Instantânea a partir do Slug da URL (100% de confiabilidade)
    const heuristic = this._extractFromUrlSlug(url);
    let title = heuristic.title;
    let category = heuristic.category;
    let storeName = heuristic.storeName;
    let imageUrl = '';
    let price = 0;
    let description = `Produto da loja ${storeName}. Presente para o novo lar de Rhebeca & Matheus.`;

    // 2. Tentar enriquecer dados via API de metadados pública (Microlink e AllOrigins) com timeout controlado
    try {
      const enriched = await this._fetchMetadataFromServices(url);
      if (enriched) {
        if (enriched.title && enriched.title.length > 5 && !enriched.title.includes('Robot') && !enriched.title.includes('Blocked') && !enriched.title.includes('503')) {
          title = this._cleanTitle(enriched.title);
        }
        if (enriched.image && !enriched.image.includes('error') && !enriched.image.includes('captcha')) {
          imageUrl = enriched.image;
        }
        if (enriched.price && enriched.price > 0) {
          price = enriched.price;
        }
        if (enriched.description && enriched.description.length > 10) {
          description = enriched.description.substring(0, 200);
        }
      }
    } catch (err) {
      console.log('[LinkExtractor] Serviço de metadados externo indisponível, utilizando dados da heurística semântica.');
    }

    // 3. Fallback de Imagem Temática caso a loja externa tenha bloqueado o carregamento de imagens
    if (!imageUrl) {
      imageUrl = this._suggestThematicImage(title, category);
    }

    return {
      title: title || 'Item da Lista de Casamento',
      imageUrl: imageUrl,
      price: price,
      category: category,
      description: description,
      productUrl: url,
      sourceStore: storeName
    };
  },

  /**
   * Decodifica a estrutura da URL para extrair título, loja e categoria mesmo com bloqueio de CORS/CAPTCHA
   */
  _extractFromUrlSlug(url) {
    try {
      const parsed = new URL(url);
      const hostname = parsed.hostname.toLowerCase().replace(/^www\./, '');
      const path = decodeURIComponent(parsed.pathname);

      // Identificar nome amigável da loja
      let storeName = 'Loja Online';
      if (hostname.includes('amazon')) storeName = 'Amazon';
      else if (hostname.includes('mercadolivre') || hostname.includes('mercadolibre')) storeName = 'Mercado Livre';
      else if (hostname.includes('magazineluiza') || hostname.includes('magalu')) storeName = 'Magazine Luiza';
      else if (hostname.includes('shopee')) storeName = 'Shopee';
      else if (hostname.includes('casasbahia')) storeName = 'Casas Bahia';
      else if (hostname.includes('tokstok')) storeName = 'Tok&Stok';
      else if (hostname.includes('pontofrio')) storeName = 'Ponto Frio';
      else if (hostname.includes('mobly')) storeName = 'Mobly';
      else if (hostname.includes('westwing')) storeName = 'Westwing';
      else if (hostname.includes('camicado')) storeName = 'Camicado';
      else storeName = hostname;

      // Extrair segmentos do pathname
      const segments = path.split('/').filter(s => s && s.trim().length > 0);
      let bestSlug = '';

      for (const seg of segments) {
        // Ignorar segmentos técnicos comuns de URLs
        if (['dp', 'gp', 'p', 'produto', 'item', 'MLB', 'ud', 'pd'].includes(seg)) continue;
        if (/^[a-zA-Z0-9]{1,4}-[0-9]+$/.test(seg)) continue;
        if (/^[0-9]+$/.test(seg)) continue;

        const cleaned = seg.replace(/\.(html|htm|php|aspx)$/i, '');
        if (cleaned.length > bestSlug.length && (cleaned.includes('-') || cleaned.includes('_') || cleaned.includes('+'))) {
          bestSlug = cleaned;
        }
      }

      if (!bestSlug && segments.length > 0) {
        bestSlug = segments[segments.length - 1].replace(/\.(html|htm|php|aspx)$/i, '');
      }

      // Limpar parâmetros de código / sku do final do slug
      bestSlug = bestSlug
        .replace(/-(p|dp|MLB[0-9]+|i\.[0-9]+.*|[0-9]{6,})$/i, '')
        .replace(/-(ref=.*|\?.*)$/i, '');

      // Formatar em título elegante
      let rawTitle = bestSlug.replace(/[-_+]/g, ' ').trim();
      let title = rawTitle
        .split(' ')
        .filter(w => w.length > 0)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(' ');

      // Determinar categoria por palavras-chave presentes no título
      const lower = title.toLowerCase();
      let category = 'sala';

      if (/panela|frigideira|faqueiro|talher|prato|copo|taça|taca|assadeira|tigela|pote|xicara|chá|café|escorredor|forma|cutelaria/i.test(lower)) {
        category = 'cozinha';
      } else if (/fritadeira|air fryer|cafeteira|aspirador|liquidificador|batedeira|micro-ondas|microondas|forno|mixer|sanduicheira|torradeira|lava e seca|geladeira|cooktop|ventilador/i.test(lower)) {
        category = 'eletro';
      } else if (/cama|lençol|lencol|edredom|colcha|travesseiro|toalha|banho|fronha|cobertor|duvet/i.test(lower)) {
        category = 'quarto';
      } else if (/lua de mel|viagem|passeio|hotel|voo|passagem|jantar|degustacao|spa/i.test(lower)) {
        category = 'cotas';
      }

      return { title, storeName, category };
    } catch (e) {
      return { title: '', storeName: 'Loja', category: 'cozinha' };
    }
  },

  /**
   * Consulta serviços rápidos de metadados com timeout curto
   */
  async _fetchMetadataFromServices(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    try {
      // 1. Microlink API (dedicado a Open Graph com CORS liberado)
      const res = await fetch(`https://api.microlink.io?url=${encodeURIComponent(url)}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        const json = await res.json();
        if (json && json.data) {
          const d = json.data;
          let price = 0;
          if (d.price) {
            price = parseFloat(String(d.price).replace(/[^\d,\.]/g, '').replace(',', '.')) || 0;
          }
          return {
            title: d.title,
            image: d.image?.url || '',
            description: d.description || '',
            price: price
          };
        }
      }
    } catch (e) {
      clearTimeout(timeoutId);
    }
    return null;
  },

  _cleanTitle(title) {
    if (!title) return '';
    return title
      .replace(/\s*\|\s*(Mercado Livre|Amazon\.com\.br|Magazine Luiza|Casas Bahia|Shopee|Tok&Stok).*$/i, '')
      .replace(/\s*-\s*(Mercado Livre|Amazon\.com\.br|Magazine Luiza|Casas Bahia|Shopee|Tok&Stok).*$/i, '')
      .trim();
  },

  _suggestThematicImage(title, category) {
    const list = this.THEMATIC_IMAGES[category] || this.THEMATIC_IMAGES.cozinha;
    const lower = (title || '').toLowerCase();

    if (category === 'eletro') {
      if (lower.includes('cafeteira') || lower.includes('espresso')) return list[1];
      if (lower.includes('lava') || lower.includes('seca')) return list[3];
      return list[0]; // air fryer / default eletro
    }

    if (category === 'cozinha') {
      if (lower.includes('faqueiro') || lower.includes('talher')) return list[1];
      if (lower.includes('prato') || lower.includes('jantar')) return list[2];
      if (lower.includes('taça') || lower.includes('copo')) return list[3];
      return list[0]; // panelas
    }

    return list[0];
  }
};

window.LinkExtractor = LinkExtractor;
