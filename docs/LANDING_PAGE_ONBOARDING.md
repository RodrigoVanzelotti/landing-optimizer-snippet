# Roteiro de onboarding da landing page do Landing Optimizer

Use este roteiro para tratar a própria landing page como um site de cliente. O objetivo da primeira call é medir **pedidos de conversa recebidos** com a tag que já está instalada e com alterações apenas nos atributos de elementos existentes. O [guia geral de onboarding](CLIENT_LABELING.md) é a referência para o contrato de marcação e para outros tipos de site.

## Ponto de partida

| Item | O que foi observado |
| --- | --- |
| Página comercial | A rota `/` retorna HTTP 200 e contém uma tag externa do SDK no `<head>`. A página publicada está sem `data-lo-role` e sem a marcação de confirmação. |
| Entrada no formulário | O CTA de abertura e o link da seção de impacto apontam para `#conversar`. Eles levam ao formulário na mesma página. |
| Tentativa de contato | O formulário `#contact-form` envia para `POST /api/leads`. O pathname continua `/`. |
| Confirmação | O elemento `#form-success` começa oculto. O script do site só o mostra depois de a API retornar sucesso com `ok: true`. Progresso e erros usam `#form-status`. |
| Outras rotas | `/quem-somos` e `/pesquisas` são páginas auxiliares e foram servidas sem o SDK. Ficam fora deste onboarding de captação. |
| Versão publicada | O bundle servido na URL da tag contém suporte a confirmação por elemento e aos eventos de jornada. A disponibilidade da UI e a persistência da meta ainda precisam ser conferidas no cadastro do site. |

A confirmação significa **pedido recebido**. O agendamento da conversa acontece depois, fora deste fluxo. A inspeção pública não enviou nenhum formulário. [Página publicada](https://landing-optimizer-landing-page-505424813528.southamerica-east1.run.app/) · [Script publicado do formulário](https://landing-optimizer-landing-page-505424813528.southamerica-east1.run.app/script.js)

## 1. Abrir a call e confirmar a instalação

1. Alinhe o resultado com o responsável pelo site. Use como pergunta: “Quando a pessoa envia o formulário, qual mensagem prova que o pedido chegou?”. Neste caso, abra a seção de contato e identifique o elemento que mostra **Pedido recebido**.
2. Em **Sites → Instalação do código**, abra o cadastro correspondente ao domínio da landing page. Compare a tag instalada com a gerada para esse cadastro. A página já contém o script, então a ação na call é conferir a instalação existente. Em caso de outro domínio autorizado, confira o cadastro e a origem antes de copiar qualquer configuração.
3. No navegador, abra a rota `/`, confirme que o bundle carrega e procure `page_view` nas requisições de ingestão. Se houver bloqueio de CSP ou do gerenciador de consentimento do próprio site, valide o carregamento no estado em que a coleta deve estar habilitada.
4. Combine quem edita os atributos e quem pode publicar. A pessoa com acesso ao site altera o HTML existente. O operador do Landing Optimizer configura a meta e a jornada. Combine também um ambiente ou fluxo em que seja permitido criar um pedido de teste.

## 2. Aplicar a marcação mínima

Na rota `/`, aplique estes atributos aos elementos existentes. Mantenha os IDs HTML nativos, o estado `hidden` da mensagem de sucesso, a região acessível de status e o comportamento do formulário.

| Elemento no editor ou no DOM | Atributo a adicionar | Motivo |
| --- | --- | --- |
| Formulário de contato `#contact-form` | `data-lo-id="lead-form"` | Vincula a confirmação ao envio do formulário certo |
| Mensagem “Pedido recebido” em `#form-success` | `data-lo-id="lead-confirmation"` | Identifica o elemento que só aparece após sucesso |
| Contêiner do e-mail `.field:has(> #email)` | `data-lo-ignore` | Exclui o campo de contato dos alvos observados |
| Contêiner do site `.field:has(> #website)` | `data-lo-ignore` | Exclui o campo de site dos alvos observados |
| Status de progresso e erro `#form-status` | `data-lo-ignore` | Mantém os estados intermediários fora da marcação |

Os dois IDs funcionam sem `data-lo-role` e mantêm a descoberta automática da página. O SDK usa o ID do formulário ao receber o evento de envio, mesmo sem papel. A mensagem de sucesso deve ficar fora de qualquer ancestral com `data-lo-ignore`. Os campos continuam excluídos. Como são os controles em que o usuário normalmente entra com foco, evite usar `form_start` como indicador obrigatório de aceite. Use `form_submit` para observar a tentativa.

Esta fase mantém a tag existente e dispensa código de rastreamento no formulário, evento global, integração de servidor e página de obrigado.

## 3. Registrar a meta no dashboard

Em **Sites → Instalação do código → Metas de conversão**, cadastre:

| Campo | Valor |
| --- | --- |
| Nome | `lead_request_confirmed` |
| Tipo | **Elemento de confirmação** |
| Caminho da página | `/` |
| ID da confirmação | `lead-confirmation` |
| ID do formulário | `lead-form` |
| Meta favorita | Marcar se pedidos recebidos forem o principal indicador desta página |

Preencha os IDs simples na UI. O SDK aguarda o envio do formulário vinculado e conta quando o elemento de confirmação aparece na mesma rota. Reabra a página depois de salvar para carregar a nova configuração.

Se já existir uma meta equivalente por elemento, mantenha a meta existente e use seu nome na jornada. Caso exista uma meta legada de **Evento personalizado**, como `lead_received`, confira seus vínculos antes de alterar a configuração de qualquer experimento. Use a meta por elemento para o fluxo publicado atual. O histórico pode ser preservado.

Em **Visão geral → Dados e indicadores → Jornada de conversão**, salve:

```text
/
event:lead_request_confirmed
```

A jornada mostra quantas sessões passaram pela home e chegaram a um pedido confirmado na janela de 30 minutos. Use o nome da meta efetivamente salva depois de `event:`. O clique em `#conversar` navega dentro da página e pode ser acompanhado como interação quando o CTA é mapeado. O relatório de navegação por CTA depende de uma mudança de pathname. Ele não atribui o lead ao CTA da âncora. Também convém evitar uma meta de tentativa de envio para este onboarding, pois `form_submit` já serve como diagnóstico.

## 4. Fazer o aceite e entregar ao cliente

| Checagem | Como testar | Resultado esperado |
| --- | --- | --- |
| Instalação e marcação | Abra a home em desktop e mobile. Inspecione os atributos e a aba **Rede** | Um SDK instalado, IDs únicos e `page_view` em `/`. A marcação mínima mantém a descoberta automática |
| Clique no CTA | Use o botão de abertura | A página vai até o formulário e o pathname continua `/`. Zero conversões |
| Falha de validação ou armazenamento | Em ambiente autorizado, provoque uma falha | O estado de erro aparece e `#form-success` continua oculto. Zero conversões, mesmo quando houver `form_submit` |
| Pedido salvo | Envie um pedido de teste autorizado. Confira a resposta do formulário e o evento do SDK | A API confirma a gravação, aparece **Pedido recebido** e o SDK envia `element_visible` com a confirmação e o formulário correspondentes |
| Persistência e repetição | Confira a meta no dashboard. Recarregue a home e, no mesmo fluxo de teste, verifique uma renderização repetida da confirmação | Um pedido confirmado soma uma conversão. Recarregar a home ou renderizar a mesma confirmação não soma outra |
| Experimento de homologação | Se houver autorização, selecione a meta como principal em um experimento de teste | A conversão posterior à exposição é atribuída à variante correspondente |

A jornada usa dias UTC completos. Para aceitar a instalação no dia da call, confira a ingestão e a persistência da meta em uma tela ou período que inclua o teste. Use o relatório da jornada para acompanhar a progressão conforme o período amadurece. Uma resposta de ingestão no navegador confirma o recebimento do lote. Confira também o que foi persistido.

Registre no encerramento o domínio, a rota, os atributos aplicados, o nome da meta, o que foi validado e quem poderá publicar ou corrigir o que faltar. Se a pessoa puder colar a tag mas o editor não permitir marcar `#form-success`, encerre com coleta de visitas e as interações observáveis. A meta de pedidos fica pendente do acesso ao elemento ou de outro sinal de sucesso já existente.

## 5. Habilitar o mapa para experimentos, se necessário

Use esta etapa quando houver uma pergunta concreta sobre posição dos CTAs ou um alvo de experimento. Por exemplo, para comparar o texto do CTA inicial, o alvo é `[data-lo-id="hero-contact"]` e a meta principal é `lead_request_confirmed`.

A primeira ocorrência de `data-lo-role` coloca toda a página em modo manual. Aplique o mapa abaixo como conjunto quando for usar esse modo, conferindo as cópias mobile e desktop. Use os seletores da primeira coluna só para localizar o HTML. Os IDs da última coluna são as identidades permanentes. Preserve a confirmação `lead-confirmation` sem papel e os três pontos com `data-lo-ignore` da configuração mínima.

| Localizador na home | `data-lo-role` | `data-lo-id` |
| --- | --- | --- |
| `#site-header > a` | `cta` | `nav-home` |
| `#menu-toggle` | `cta` | `nav-menu-toggle` |
| `#site-navigation` | `navigation` | `main-navigation` |
| `#site-navigation a[href="/quem-somos"]` | `cta` | `nav-about` |
| `#site-navigation a[href="/pesquisas"]` | `cta` | `nav-research` |
| `.story-hero` | `hero` | `main-hero` |
| `#hero-title` | `heading` | `hero-headline` |
| `.hero-description` | `heading` | `hero-subheadline` |
| `.hero-primary-cta` | `cta` | `hero-contact` |
| `#processo` | `section` | `how-it-works` |
| `#decision-title` | `heading` | `decision-headline` |
| `button[data-process-mode="legacy"]` | `cta` | `process-legacy` |
| `button.turn-switch` | `cta` | `process-toggle` |
| `button[data-process-mode="continuous"]` | `cta` | `process-continuous` |
| `button[data-cycle-step="observe"]` | `cta` | `process-step-observe` |
| `button[data-cycle-step="propose"]` | `cta` | `process-step-propose` |
| `button[data-cycle-step="approve"]` | `cta` | `process-step-approve` |
| `button[data-cycle-step="test"]` | `cta` | `process-step-test` |
| `button[data-cycle-step="decide"]` | `cta` | `process-step-decide` |
| `#descobrir` | `section` | `behavior-signals` |
| `#discovery-title` | `heading` | `discovery-headline` |
| `button[data-signal-control="attention"]` | `cta` | `signal-attention-mobile` |
| `button[data-signal="attention"]` | `cta` | `signal-attention-desktop` |
| `button[data-signal-control="friction"]` | `cta` | `signal-friction-mobile` |
| `button[data-signal="friction"]` | `cta` | `signal-friction-desktop` |
| `button[data-signal-control="scroll"]` | `cta` | `signal-scroll-mobile` |
| `button[data-signal="scroll"]` | `cta` | `signal-scroll-desktop` |
| `#experimentar` | `section` | `experiment-demo` |
| `#experiment-title` | `heading` | `experiment-headline` |
| `#story-approve-demo` | `cta` | `demo-approve-mobile` |
| `#experiment-story-results` | `section` | `demo-results-mobile` |
| `#story-reset-demo` | `cta` | `demo-reset-mobile` |
| `#experiment-story-back` | `cta` | `demo-back-mobile` |
| `#experiment-story-next` | `cta` | `demo-next-mobile` |
| `#approve-demo` | `cta` | `demo-approve-desktop` |
| `#reset-demo` | `cta` | `demo-reset-desktop` |
| `#experiment-analysis` | `section` | `demo-results` |
| `.impact-section` | `section` | `revenue-impact` |
| `#impact-title` | `heading` | `impact-headline` |
| `.impact-section a[href="#conversar"]` | `cta` | `impact-contact` |
| `.impact-calculator` | `section` | `revenue-calculator` |
| `section.faq` | `faq` | `main-faq` |
| `#faq-title` | `heading` | `faq-headline` |
| `.faq-list > details:nth-of-type(1)` | `faq` | `faq-business-fit` |
| `.faq-list > details:nth-of-type(2)` | `faq` | `faq-traffic` |
| `.faq-list > details:nth-of-type(3)` | `faq` | `faq-approval` |
| `.faq-list > details:nth-of-type(4)` | `faq` | `faq-performance` |
| `.faq-list > details:nth-of-type(5)` | `faq` | `faq-results` |
| `.faq-list > details:nth-of-type(6)` | `faq` | `faq-customization` |
| `#conversar` | `section` | `contact-section` |
| `#contact-title` | `heading` | `contact-headline` |
| `#contact-form` | `form` | `lead-form` |
| `#contact-form > h3` | `heading` | `lead-form-headline` |
| `#submit-button` | `cta` | `lead-submit` |
| `#scroll-hint` | `cta` | `scroll-continue` |
| `body > footer.site-footer` | `footer` | `main-footer` |
| `body > footer.site-footer > a` | `cta` | `footer-home` |

As ações da demonstração, calculadora, navegação e FAQ servem à análise de interação. O único resultado de captação deste roteiro é o pedido recebido. Ao testar texto num elemento com filhos, como um botão com ícone ou um título com formatação, preserve a estrutura existente e escolha um alvo mais preciso antes de publicar uma mudança de texto.

## Evidência e pendências deste roteiro

A inspeção pública confirmou o script da home e a existência da mensagem dedicada. O mapa mínimo e o mapa manual foram aplicados em memória ao HTML local e passaram no [validador de atributos](../.agents/skills/label-landing-page/scripts/validate-labels.js). O mínimo permaneceu em descoberta automática. O manual tem 57 elementos mapeados, além do ID da confirmação.

A marcação no site, o cadastro da meta e um envio de teste com conferência no dashboard fazem parte da execução do onboarding. Nenhuma dessas ações foi executada ao preparar este roteiro.
