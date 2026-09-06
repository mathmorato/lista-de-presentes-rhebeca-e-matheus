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

## 2. Identidade visual e design system

### 2.1 Paleta de cores e estética
A interface deve transmitir sofisticação, elegância e leveza, apropriada para cerimônias de casamento.
- Branco e Off-White (Fundo e Base): Branco puro (#FFFFFF), Branco Quente/Pérola (#FAFAF8) e Creme suave (#F4F5F0).
- Verde Oliva (Destaques e Ações):
  - Oliva Principal: tom botânico balanceado (#606C38 ou #556B2F).
  - Oliva Claro (Fundos sutis, tags de status): #E8ECE0 ou #DDA15E.
  - Oliva Profundo (Textos principais, cabeçalhos): tom escuro de oliva (#283618).
- Cores de Estado: Sucesso (verde sálvia #8FBC8F ou #588157), Atenção (dourado/âmbar discreto #DDA15E), Erro (terracota suave/vermelho queimado #BC6C25 ou #B04A3B).

### 2.2 Tema visual e suporte a temas (Modo Claro padrão)
- Modo Claro (Padrão e Prioritário): Foco em luminosidade, com base branca/off-white e contraste marcado pelo verde oliva profundo.
- Modo Escuro (Dark Mode opcional/elegante): Se ativado, o fundo deve ser oliva ultra escuro/verde musgo profundo (não preto puro), mantendo tipografia clara e detalhes em verde oliva desbotado.
- Contraste e Legibilidade: Validar que cartões de presentes, botões de cotação/Pix e mensagens de felicitações tenham contraste acessível (WCAG AA) contra o plano de fundo.

### 2.3 Tipografia, componentes e ícones
- Tipografia: Combinação de títulos em serifa editorial/romântica (Playfair Display / Cormorant Garamond) com textos de apoio e formulários em sem serifa legível (Inter, Montserrat).
- Cards e Molduras: Cantos suavemente arredondados, bordas sutis em tom oliva claro e sombras difusas para dar acabamento sofisticado aos cartões de presentes.
- Padrão de Ícones: Obrigatoriamente ícones de linha (line icons) com traço uniforme (stroke-width="1.5" ou "2"), fill="none" e terminações suaves (stroke-linecap="round"). Proibido o uso de ícones pesados ou com preenchimento sólido.

## 3. Arquitetura de dados e persistência híbrida
- Dualidade IndexedDB (Local) e Supabase (Nuvem).
- Sincronização em Tempo Real e tolerância Offline-First.
- Atualização imediata de reservas e cotas para evitar compras duplicadas.
- Exclusão completa local e na nuvem em cascata.

## 4. Sistema de versionamento
- Formato estrito: v.X.Y.Z (Z: 0-9, Y: 0-9).
- v.1.0.0 inicial.
- Locais obrigatórios de atualização:
  1. Rodapé visível do site (index.html).
  2. Painel de gerenciamento administrativo dos noivos.
  3. Cabeçalho dos arquivos de controle JavaScript (js/*.js).

## 5. Fluxo de execução e Git
- Formato commit: `v.X.Y.Z: descrição objetiva da alteração`
- Push automático para origin main.

## 6. Comunicação ao final da execução
- Emitir estritamente o resumo padrão (Versão, Alterações, Arquivos principais alterados, Validação, Git).
