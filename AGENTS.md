# Diretrizes e Regras do Agente - Lista de Presentes Rhebeca & Matheus

Estas diretrizes constituem autorização prévia para realizar todas as modificações necessárias no projeto, desde que estejam alinhadas ao contexto de gerenciamento de lista de presentes de casamento e respeitem integralmente este documento.

## 1. Regra geral de execução

### 1.1 Execução autônoma
- Executar diretamente as alterações necessárias sem solicitar autorização prévia.
- Não interromper o fluxo para confirmar criação, edição ou remoção de arquivos tecnicamente necessários.
- Escolher a solução mais adequada com base na estrutura existente, mantendo consistência arquitetural.
- Corrigir automaticamente erros encontrados durante a implementação ou testes.
- A tarefa só é considerada concluída após validação funcional completa.

### 1.2 Limite da autonomia
- Não remover itens, cotas, mensagens ou dados de convidados sem necessidade técnica.
- Não descaracterizar a identidade visual de casamento (paleta branco e verde oliva).
- Não substituir bibliotecas de UI, utilitários ou dependências sem justificativa clara.
- Priorizar sempre a solução de menor impacto e maior estabilidade para o projeto existente.

---

## 2. Identidade visual e design system

### 2.1 Paleta de cores e estética
A interface deve transmitir sofisticação, elegância e leveza, apropriada para cerimônias de casamento.
- **Branco e Off-White (Fundo e Base):** Branco puro (`#FFFFFF`), Branco Quente/Pérola (`#FAFAF8`) e Creme suave (`#F4F5F0`).
- **Verde Oliva (Destaques e Ações):**
  - Oliva Principal: tom botânico balanceado (`#606C38` ou `#556B2F`).
  - Oliva Claro (Fundos sutis, tags de status): `#E8ECE0` ou `#DDA15E` em toques dourados sutis.
  - Oliva Profundo (Textos principais, cabeçalhos): tom escuro de oliva (`#283618`).
- **Cores de Estado:** Sucesso (verde sálvia), Atenção (dourado/âmbar discreto), Erro (terracota suave/vermelho queimado).

### 2.2 Tema visual e suporte a temas (Modo Claro padrão)
- **Modo Claro (Padrão e Prioritário):** Foco em luminosidade, com base branca/off-white e contraste marcado pelo verde oliva profundo.
- **Modo Escuro (Dark Mode opcional/elegante):** Se ativado, o fundo deve ser oliva ultra escuro/verde musgo profundo (não preto puro), mantendo tipografia clara e detalhes em verde oliva desbotado.
- **Contraste e Legibilidade:** Validar que cartões de presentes, botões de cotação/Pix e mensagens de felicitações tenham contraste acessível (WCAG AA) contra o plano de fundo.

### 2.3 Tipografia, componentes e ícones
- **Tipografia:** Combinação de títulos em serifa editorial/romântica (ex.: Playfair Display, Cormorant Garamond) com textos de apoio e formulários em sem serifa legível (ex.: Inter, Montserrat).
- **Cards e Molduras:** Cantos suavemente arredondados, bordas sutis em tom oliva claro e sombras difusas para dar acabamento sofisticado aos cartões de presentes.
- **Padrão de Ícones:** Obrigatoriamente ícones de linha (*line icons*) com traço uniforme (`stroke-width="1.5"` ou `"2"`), `fill="none"` e terminações suaves (`stroke-linecap="round"`). Proibido o uso de ícones pesados ou com preenchimento sólido.

---

## 3. Arquitetura de dados e persistência híbrida

A aplicação deve operar sob persistência compartilhada e tolerância offline para noivos e convidados.

### 3.1 Dualidade IndexedDB (Local) e Supabase (Nuvem)
- **Sincronização em Tempo Real:** Toda criação, edição ou exclusão de presentes, cotas financeiras, reservas feitas por convidados ou confirmações de presença deve atualizar imediatamente o IndexedDB local e a base PostgreSQL no Supabase (com fallback offline/local caso o Supabase não esteja configurado ou sem rede).
- **Controle de Reservas e Cotas:** Quando um convidado reservar um presente físico ou pagar uma cota via Pix, o status deve ser atualizado no Supabase imediatamente para evitar compras duplicadas do mesmo item por outros convidados.
- **Exclusões Completas:** A remoção de um item da lista deve expurgar os registros associados no cache local e disparar o comando de exclusão em cascata na nuvem.
- **Offline-First:** O catálogo deve carregar instantaneamente do IndexedDB local, sincronizando mudanças com a nuvem em segundo plano.

---

## 4. Sistema de versionamento

### 4.1 Formato e limites
- A versão deve seguir o formato estrito **v.X.Y.Z**, visível no rodapé da página.
- Incremento Z (0 a 9): v.1.0.0 → v.1.0.1 até v.1.0.9.
- Incremento Y (ao atingir 9 em Z): v.1.0.9 → v.1.1.0.
- Incremento X (ao atingir 9 em Y e Z): v.1.9.9 → v.2.0.0.
- **Limites:** Z e Y nunca podem exceder 9. Nunca utilizar valores como v.1.0.10 ou v.1.10.0.

### 4.2 Locais obrigatórios de atualização
A cada modificação de arquivos, atualizar a versão em:
1. Rodapé visível do site (`index.html`).
2. Painel de gerenciamento administrativo dos noivos.
3. Cabeçalho dos arquivos de controle JavaScript (`js/*.js`).

---

## 5. Fluxo de execução e Git

### 5.1 Ciclo de trabalho
- **Antes:** Inspecionar versão atual, determinar o próximo incremento (v.X.Y.Z) e mapear os componentes impactados (catálogo, painel de cotas, checkout/reserva).
- **Durante:** Aplicar o código preservando os estilos em verde oliva/branco, ícones de linha e persistência dupla (IndexedDB + Supabase).
- **Após:** Testar responsividade mobile (foco no convidado usando smartphone), verificar fluxos de reserva de presentes, atualizar a versão no rodapé e validar a ausência de erros no console.

### 5.2 Padrão de commits
- **Formato da mensagem:** `v.X.Y.Z: descrição objetiva da alteração`
  - *Exemplo:* `v.1.0.4: adiciona modal de pagamento via chave Pix para cotas de lua de mel`
- **Descrição obrigatória:** Indicar versão anterior, nova versão, lista de alterações e rotinas de validação realizadas.
- **Publicação:** Executar commit local e sincronizar automaticamente com `git push origin main`.

---

## 6. Comunicação ao final da execução

Ao concluir qualquer alteração solicitada, emitir unicamente o resumo:

```markdown
Versão: v.X.Y.Z

Alterações:
[Resumo das modificações efetuadas na lista de casamento.]

Arquivos principais alterados:
[Caminho dos arquivos modificados.]

Validação:
[Resultados dos testes (persistência Supabase/IndexedDB, responsividade e layout branco/verde oliva).]

Git:
[Mensagem do commit registrado e confirmação de push no branch remoto.]
```
