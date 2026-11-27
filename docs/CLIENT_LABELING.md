# Onboarding do Landing Optimizer

Use este roteiro quando receber a URL de um site de cliente. Entregue o mapa dos elementos reais que devem receber atributos HTML e os valores exatos das metas a registrar no dashboard.

A partir da URL, inspecione as páginas públicas e entregue instruções para o operador ou para quem edita o CMS. Aplique mudanças no site, publique ou registre metas quando houver autorização e acesso para essas ações.

## Escolha o menor nível de instalação que responde à pergunta

O cliente instala a tag do próprio site uma vez no `<head>` compartilhado. O operador configura no dashboard o avanço ou resultado que quer medir. Peça marcação apenas para distinguir um elemento, dar ao SDK um sinal observável ou escolher um alvo de experimento. Em conteúdo gerado, aplique a marcação no componente ou template que renderiza a coleção. Quando o resultado pertence ao sistema de negócio, procure um sinal global da plataforma.

| Maneira de medir | O que pedir ao cliente | Para que serve | Disponibilidade |
| --- | --- | --- | --- |
| Páginas e rotas | Instalar o snippet nas páginas observadas | Contar a chegada a uma etapa, como cadastro, checkout ou confirmação | Metas por caminho e jornada ordenada no dashboard |
| Interação em elemento | Marcar o link, botão ou formulário que precisa ser identificado | Medir cliques, tentativas e o desempenho de alvos específicos | A jornada associa cliques compatíveis à chegada observada na mesma aba e origem |
| Confirmação no DOM | Marcar o elemento de sucesso existente e, se útil, o formulário que inicia a ação | Medir um sucesso que aparece na mesma rota | A meta por elemento existe no código. Verifique a versão publicada |
| Marcação em template | Marcar uma vez o template ou componente que gera páginas ou controles | Cobrir novos produtos, serviços ou artigos sem tarefas por item | Use IDs únicos para alvos individuais ou um `data-lo-group` repetível para agrupar CTAs |
| Evento global do site | Selecionar um evento já emitido no `dataLayer` | Medir resultados que o aplicativo conhece, como cadastro criado ou pedido pago | Configure a associação com uma meta de evento no dashboard. Disponível com armazenamento PostgreSQL |
| Evento de servidor | Conectar uma fonte autenticada, como o backend ou o webhook de pedidos | Medir resultados assíncronos ou em checkout hospedado | Conector com deduplicação no PostgreSQL. Atribuição depende de vínculo válido com a sessão |

Comece pela opção de menor esforço que responde à pergunta do cliente. Pode haver uma meta de avanço útil já na primeira call e um resultado de negócio cuja confirmação fica para uma segunda etapa.

## 1. Inspecione o site publicado

1. Abra a URL fornecida. Registre o domínio final, a rota, as páginas relevantes ligadas ao fluxo e o resultado de negócio que o site busca, como **receber um pedido**, **concluir um cadastro** ou **confirmar uma compra**.
2. Examine o DOM renderizado em desktop e mobile. Localize os CTAs, formulários, cópias por breakpoint e elementos que aparecem depois do carregamento. Siga os links públicos do fluxo e identifique se há navegação sem recarga, outra origem, iframe ou etapa que exige login. Use posição, texto público e um seletor verificável para localizar cada alvo.
3. Desenhe o caminho em ordem. Para cada etapa, registre o que a chegada comprova, quais CTAs levam até ela, possíveis entradas diretas e onde o resultado final acontece. Procure caminhos, um elemento de confirmação ou um sinal global já emitido. Use evidência pública quando disponível. Execute envios, cadastros ou compras somente em um ambiente ou fluxo de teste autorizado.
4. Verifique a instalação existente e a compatibilidade da versão servida do SDK com o dashboard e a API publicados. Uma mudança no repositório ou a existência de uma opção na UI não comprovam suporte em produção. Se não tiver acesso ao CMS, informe quais atributos o operador precisa conseguir editar. Se não puder consultar as metas atuais, indique que o operador deve verificar se já existe uma meta equivalente.

## 2. Monte o mapa de atributos

| `data-lo-role` | Elemento a marcar |
| --- | --- |
| `navigation`, `footer` | Contêineres de navegação e rodapé |
| `hero`, `section` | Abertura e outras seções relevantes |
| `heading` | Título ou subtítulo. Prefira o menor elemento que contém o texto, em especial se for alvo de `set_text` |
| `cta` | Link, botão ou outro controle realmente acionado, em vez do contêiner ou ícone |
| `form` | O próprio `<form>` nativo |
| `pricing`, `testimonials`, `faq` | Preços, prova social e perguntas frequentes |

- Use `data-lo-role` e `data-lo-id` em cada elemento do mapa. O ID deve seguir `^[a-z][a-z0-9-]{0,63}$`. Preserve IDs instalados quando forem válidos. Use IDs diferentes para elementos duplicados no mesmo documento, inclusive versões desktop e mobile ocultas. Para metas ou experimentos que pedem um seletor, use o formato exato `[data-lo-id="id-do-elemento"]`.
- Qualquer `data-lo-role` ativa o modo manual na página inteira. Cubra todos os CTAs, formulários e áreas que devem entrar no mapa e mantenha até 60 elementos mapeados por página. Páginas sem papéis mantêm a descoberta automática. Com apenas o snippet, a coleta de rotas continua disponível e a descoberta automática de CTAs é heurística.
- Em um template que mostra um produto por página, reutilize IDs por **posição** entre páginas, como `produto-comprar-principal`. Se o mesmo componente aparecer várias vezes no mesmo documento, use `data-lo-group="vitrine-comprar"` para agregar os cliques. Dê um `data-lo-id` único a cada alvo que precise ser individualizado em um experimento. Num botão de navegação sem `href`, informe o destino já usado pelo botão com `data-lo-destination="/cadastro"`. O atributo só serve à medição.
- Um elemento usado só para confirmar sucesso pode receber apenas `data-lo-id`, sem papel. Campos individuais, textos com dados pessoais e subárvores sensíveis ficam fora da marcação. Use `data-lo-ignore` nas áreas sensíveis. O alvo da confirmação precisa estar fora das subárvores ignoradas.
- Preserve os links, o layout, os estados, a validação e a acessibilidade existentes. Se a marcação atual usa IDs diferentes, sinalize os seletores de metas, experimentos e relatórios que precisariam ser revistos.

## 3. Escolha as metas a partir da evidência

Na UI, use **Sites → Instalação do código → Metas de conversão**. Para cada resultado de negócio, escolha o sinal mais confiável disponível na versão publicada.

| Sinal encontrado no site | Tipo na UI | Valores a entregar |
| --- | --- | --- |
| Rota que representa uma etapa de avanço ou uma confirmação | **Página de confirmação** (`url`) | Nome que descreve a chegada, correspondência **Exatamente igual** e o caminho, como `/cadastro` ou `/obrigado`. Para uma família de caminhos, use **Começa com** quando um prefixo dedicado cobrir todos os casos |
| Elemento exclusivo de sucesso na mesma rota | **Elemento de confirmação** (`element_visible`) | Nome da meta, caminho onde a ação ocorre, ID da confirmação e, se aplicável, ID do formulário |
| Chamada de conversão que já existe e só roda após sucesso | **Evento personalizado** (`event`, em **Avançado**) | O nome exato enviado pela chamada existente |
| Apenas um formulário nativo envia | **Tentativa de envio** (`form_submit`, em **Avançado**) | Só recomende se houver interesse explícito em acompanhar a tentativa como meta intermediária. Dê o nome e o seletor exato do formulário |
| Apenas clique, ou sucesso sem sinal acessível ao SDK | **Nenhuma meta de sucesso verificável** | Indique a interação que pode ser acompanhada e qual informação falta para medir o resultado |

- **Página de confirmação.** Confira se o script também roda no destino. O matcher usa o caminho, sem parâmetros ou fragmentos. Quando quiser medir a transição, preencha também **Caminho anterior (opcional)** com uma rota ou família como `/produto/*`. Sem esse campo, também contam acessos diretos e recargas. Nomeie `/cadastro` como **Chegou ao cadastro**. Para chamar uma visita de cadastro concluído, confirme que o destino é exclusivo desse resultado.
- **Elemento de confirmação.** Marque o elemento dedicado que já existe. Ele deve estar oculto ou ausente no momento da ação e aparecer na mesma rota em até dois minutos. Escolha um alvo que apareça só no sucesso. Um painel já visível que apenas troca o texto entre erro e sucesso não serve. Com o ID de um formulário nativo, o SDK aguarda um envio desse formulário. Sem esse ID, aguarda um clique em controle interativo ou um envio nessa rota. No dashboard, preencha os IDs sem a sintaxe do seletor. Depois de salvar, reabra a página para carregar a configuração atualizada.
- **Evento personalizado.** Se a versão publicada já chama `LandingOptimizer.conversion(...)`, confirme em que momento e com qual nome. Para reaproveitar um evento já disponível no `dataLayer`, cadastre uma meta de evento e associe o nome do evento ao da meta em **Visão geral → Dados e indicadores → Jornada de conversão → Evento global do site**. O evento `purchase` precisa trazer um ID opaco da transação. Escolha uma fonte de confirmação por resultado.
- **Limites do fluxo.** Um CTA mede um clique. Um envio mede uma tentativa. Um checkout externo, iframe ou Shadow DOM só permite medir o sucesso quando há um sinal suportado que o SDK consegue observar no documento em que está instalado. Quando o sinal depender de acesso, publicação ou edição de marcação que ainda não ocorreu, apresente a meta como condicional e diga o que falta confirmar.
- Indique qual meta usar como **meta principal** de cada experimento. Um teste na home pode medir a chegada ao cadastro. Um teste no cadastro pode medir a chegada à etapa seguinte. O operador pode marcar como favorita a meta que reflete o objetivo principal do site. Verifique as metas existentes antes de sugerir outra. Cadastro de meta não exige zerar o histórico. As metas por condição se aplicam a eventos futuros.

### Casos para orientar a call

| Site ou fluxo | Primeira configuração | O que marcar ou integrar |
| --- | --- | --- |
| Landing com vários CTAs para cadastro | Meta de chegada a `/cadastro`. Liste a etapa seguinte observada, como `/verificar-email` | Marque os CTAs por posição quando o operador precisar compará-los. A chegada à tela de verificação mede avanço até essa tela |
| Formulário de lead com página de obrigado | Meta pela rota de obrigado | Marque o formulário e o CTA apenas se a análise ou um experimento precisar deles |
| Cadastro, formulário ou agendamento em uma única tela | Meta por elemento, se houver uma confirmação dedicada no documento | Marque a confirmação e, se existir envio nativo, o formulário. Se só um iframe externo souber o resultado, encontre uma integração oficial da plataforma ou relate o limite |
| Loja com catálogo dinâmico | Comece por família de páginas de produto, carrinho e checkout. Separe chegada ao checkout de compra confirmada | Se precisar de interação, marque o template ou o componente compartilhado. Use uma confirmação central, evento global ou, quando suportado, backend para compra paga |
| WhatsApp, telefone, app ou outro destino externo | Acompanhe a saída pelo CTA como etapa de intenção | Marque o link quando houver mais de um ponto de saída. A conversa, ligação atendida ou venda exige um sinal da plataforma ou do CRM |

## 4. Entregue instruções de instalação e aceite

- Localize o cadastro do próprio site no dashboard e oriente o operador a copiar a tag gerada para o `<head>` compartilhado. Use a mesma instalação nas rotas relevantes do fluxo, no documento principal e nas origens autorizadas. Se o script estiver bloqueado pela política da página, verifique **Orientações de segurança (CSP)** na tela de instalação.
- Depois da publicação, confira em desktop e mobile a unicidade dos IDs, a cobertura da marcação e o funcionamento dos controles. Se houver acesso ao DOM, use o [validador de atributos](../.agents/skills/label-landing-page/scripts/validate-labels.js). Ele verifica a marcação. Confira separadamente se `page_view`, `page_map` e a interação esperada chegam à API e aparecem no dashboard.
- Quando houver teste autorizado, confirme que uma falha gera zero conversões e um sucesso gera uma. Para confirmação na mesma página, teste também a mensagem já visível na abertura e uma renderização repetida. Se houver experimento de homologação, confira a atribuição à variante exposta. Informe na entrega quais verificações foram possíveis.

## Formato da resposta ao receber a URL

1. **Site e fluxo**. URL inspecionada, rotas verificadas, resultado de negócio e o que confirma o sucesso. Cite a página ou a evidência pública e identifique o que ficou sem confirmação.
2. **Mapa para aplicar**. Use uma linha por elemento real ou por ponto de aplicação em um template compartilhado. Diga quando o snippet basta para a etapa.

   | Rota | Localização no site e seletor atual, se houver | `data-lo-role` | `data-lo-id` | Ação |
   | --- | --- | --- | --- | --- |
   | Caminho real | Texto ou referência verificável no DOM | Papel ou campo vazio para confirmação | ID exato | Adicionar, manter ou ajustar |

3. **Metas a registrar no dashboard**. Dê uma linha por meta com valores prontos para copiar e identifique se mede avanço, tentativa ou resultado de negócio. Quando o resultado final estiver fora do alcance, escreva **Resultado final sem sinal verificável** e entregue as etapas que já podem ser medidas.

   | Nome exato | Tipo na UI | Campos e valores | Quando conta | Ação e prontidão |
   | --- | --- | --- | --- | --- |
   | Nome que será salvo | Rótulo da interface | Somente os campos do tipo escolhido | Sinal observado | Criar, manter ou ajustar. Pronta, depende da marcação ou suporte pendente de verificação |

4. **Instalação e validação**. Informe onde colocar o script, o que aplicar no CMS, quais testes foram executados e quais ainda dependem de acesso. Quando houver integração global, diga onde configurá-la uma vez, quem pode fazê-lo e como verificar seu significado.

## Jornada no dashboard

Em **Visão geral → Dados e indicadores → Jornada de conversão**, configure de duas a oito etapas. Use uma linha por etapa e termine com uma rota, uma família como `/produto/*` ou `event:compra_confirmada`, onde o nome depois de `event:` corresponde a uma meta cadastrada. O relatório conta uma passagem por etapa por sessão em até 30 minutos após a entrada. Atribui a chegada ao último clique compatível quando observado e mostra chegadas sem CTA identificado. Sessões que chegam direto a uma etapa posterior aparecem separadamente.

Comece pelo mesmo domínio e aba. Em homologação, teste navegação SPA, recarga, retorno, entrada no meio da jornada, vários CTAs para o mesmo destino, clique sem chegada e link aberto em outra aba. O relatório solicita um período menor quando a consulta atinge seu limite de volume.

## Integração de servidor

Para um resultado assíncrono, o administrador copia a credencial em **Jornada de conversão → Conversões de servidor**. Um backend ou adaptador que já validou o webhook da plataforma faz uma requisição a `POST /v1/server-conversions/{siteId}` na API do Landing Optimizer, com `Authorization: Bearer <credencial>` e JSON:

```json
{"goal":"compra_confirmada","transactionId":"pedido-42"}
```

Use um identificador opaco e estável, livre de dados pessoais. Entregas repetidas da mesma transação para a mesma meta contam uma vez. O backend pode guardar o valor retornado por `window.LandingOptimizer?.getSessionId?.()` quando inicia o checkout e enviá-lo em `sessionId`. O vínculo só é aceito quando a API encontra uma sessão recente do site. Sem vínculo, a compra aparece como conversão nos totais gerais e fica fora do funil por sessão. A credencial fica no servidor.

A publicação dos conectores globais depende da migração `20261127120000_conversion_receipts`. Valide o resultado da integração em uma loja de teste, incluindo um novo produto, pagamento recusado e entrega duplicada do mesmo evento.

Use apenas caminhos ou grupos e identificadores necessários ao relatório. Mantenha valores de campos, e-mails, tokens de verificação e parâmetros sensíveis fora das regras e dos eventos. Ao atravessar origens, abas ou sistemas, mostre a origem como desconhecida até haver um meio autorizado de correlacionar as etapas.
