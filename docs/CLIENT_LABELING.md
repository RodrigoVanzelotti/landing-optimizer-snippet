# Marcação e metas do Landing Optimizer a partir de uma URL

Use este roteiro quando receber a URL de um site de cliente. Entregue o mapa dos elementos reais que devem receber atributos HTML e os valores exatos das metas a registrar no dashboard.

A URL autoriza a inspeção das páginas públicas. Entregue a marcação como instrução para o operador ou para quem edita o CMS. Aplique alterações se o usuário pedir e houver acesso ao código ou ao editor. O onboarding padrão usa a tag externa no `<head>` e atributos nos elementos. Meta, publicação e exclusão de dados em produção são ações separadas e exigem autorização específica.

## 1. Inspecione o site publicado

1. Abra a URL fornecida. Registre o domínio final, a rota, as páginas relevantes ligadas ao fluxo e o resultado de negócio que o site busca, como **receber um pedido**, **concluir um cadastro** ou **confirmar uma compra**.
2. Examine o DOM renderizado em desktop e mobile. Localize os CTAs, formulários, cópias por breakpoint e elementos que aparecem depois do carregamento. Siga os links públicos do fluxo e identifique se há navegação sem recarga, outra origem, iframe ou etapa que exige login. Use posição, texto público e um seletor verificável para localizar cada alvo.
3. Descubra qual é o sinal de sucesso. Procure uma rota exclusiva de confirmação, um elemento que só aparece após o sucesso ou uma chamada de conversão já instalada. Use o HTML e o código público quando ajudarem a ligar o sinal ao resultado. Execute envios, cadastros ou jornadas de compra somente em um ambiente ou fluxo de teste autorizado. Se só conseguir observar o botão ou o formulário, registre a confirmação como **não verificada** ou **indisponível**, conforme a evidência.
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
- Qualquer `data-lo-role` ativa o modo manual na página inteira. Cubra todos os CTAs, formulários e áreas que devem entrar no mapa e mantenha até 60 elementos mapeados por página. Páginas sem papéis mantêm a descoberta automática.
- Um elemento usado só para confirmar sucesso pode receber apenas `data-lo-id`, sem papel. Campos individuais, textos com dados pessoais e subárvores sensíveis ficam fora da marcação. Use `data-lo-ignore` nas áreas sensíveis. O alvo da confirmação precisa estar fora das subárvores ignoradas.
- Preserve os links, o layout, os estados, a validação e a acessibilidade existentes. Se a marcação atual usa IDs diferentes, sinalize os seletores de metas, experimentos e relatórios que precisariam ser revistos.

## 3. Escolha as metas a partir da evidência

Na UI, use **Sites → Instalação do código → Metas de conversão**. Para cada resultado de negócio, escolha o sinal mais confiável disponível na versão publicada.

| Sinal encontrado no site | Tipo na UI | Valores a entregar |
| --- | --- | --- |
| Rota dedicada de sucesso após a ação | **Página de confirmação** (`url`) | Nome da meta, correspondência **Exatamente igual** e o caminho final, como `/obrigado` |
| Elemento exclusivo de sucesso na mesma rota | **Elemento de confirmação** (`element_visible`) | Nome da meta, caminho onde a ação ocorre, ID da confirmação e, se aplicável, ID do formulário |
| Chamada de conversão que já existe e só roda após sucesso | **Evento personalizado** (`event`, em **Avançado**) | O nome exato enviado pela chamada existente |
| Apenas um formulário nativo envia | **Tentativa de envio** (`form_submit`, em **Avançado**) | Só recomende se houver interesse explícito em acompanhar a tentativa como meta intermediária. Dê o nome e o seletor exato do formulário |
| Apenas clique, ou sucesso sem sinal acessível ao SDK | **Nenhuma meta de sucesso verificável** | Indique a interação que pode ser acompanhada e qual informação falta para medir o resultado |

- **Página de confirmação.** Confira se o script também roda na rota final. O matcher usa o caminho, sem parâmetros ou fragmentos, e também conta um acesso direto ao caminho configurado. Use uma rota exclusiva de sucesso. Em SPA, confirme que o SDK publicado emite `page_view` na mudança de caminho sem recarga.
- **Elemento de confirmação.** Marque o elemento dedicado que já existe. Ele deve estar oculto ou ausente no momento da ação e aparecer na mesma rota em até dois minutos. Escolha um alvo que apareça só no sucesso. Um painel já visível que apenas troca o texto entre erro e sucesso não serve. Com o ID de um formulário nativo, o SDK aguarda um envio desse formulário. Sem esse ID, aguarda um clique em controle interativo ou um envio nessa rota. No dashboard, preencha os IDs sem a sintaxe do seletor. Depois de salvar, reabra a página para carregar a configuração atualizada.
- **Evento personalizado.** Use apenas quando a chamada já estiver na versão publicada e o nome puder ser verificado. A migração de um evento legado para um sinal por URL ou elemento deve usar a confirmação que a versão publicada realmente oferece. Oriente o operador a evitar duas metas para o mesmo resultado.
- **Limites do fluxo.** Um CTA mede um clique. Um envio mede uma tentativa. Um checkout externo, iframe ou Shadow DOM só permite medir o sucesso quando há um sinal suportado que o SDK consegue observar no documento em que está instalado. Quando o sinal depender de acesso, publicação ou edição de marcação que ainda não ocorreu, apresente a meta como condicional e diga o que falta confirmar.
- Indique qual meta de sucesso usar como **meta principal** dos experimentos. O operador pode marcá-la como favorita para a visão geral quando isso refletir o objetivo do site. Verifique as metas existentes antes de sugerir outra. Cadastro de meta não exige zerar o histórico. As metas por condição se aplicam a eventos futuros.

## 4. Entregue instruções de instalação e aceite

- Localize o cadastro do próprio site no dashboard e oriente o operador a copiar a tag gerada para o `<head>` compartilhado. Use a mesma instalação nas rotas relevantes do fluxo, no documento principal e nas origens autorizadas. Se o script estiver bloqueado pela política da página, verifique **Orientações de segurança (CSP)** na tela de instalação.
- Depois da publicação, confira em desktop e mobile a unicidade dos IDs, a cobertura da marcação e o funcionamento dos controles. Se houver acesso ao DOM, use o [validador de atributos](../.agents/skills/label-landing-page/scripts/validate-labels.js). Ele verifica a marcação. Confira separadamente se `page_view`, `page_map` e a interação esperada chegam à API e aparecem no dashboard.
- Quando houver teste autorizado, confirme que uma falha gera zero conversões e um sucesso gera uma. Para confirmação na mesma página, teste também a mensagem já visível na abertura e uma renderização repetida. Se houver experimento de homologação, confira a atribuição à variante exposta. Informe na entrega quais verificações foram possíveis.

## Formato da resposta ao receber a URL

1. **Site e fluxo**. URL inspecionada, rotas verificadas, resultado de negócio e o que confirma o sucesso. Cite a página ou a evidência pública e identifique o que ficou sem confirmação.
2. **Mapa para aplicar**. Use uma linha por elemento real.

   | Rota | Localização no site e seletor atual, se houver | `data-lo-role` | `data-lo-id` | Ação |
   | --- | --- | --- | --- | --- |
   | Caminho real | Texto ou referência verificável no DOM | Papel ou campo vazio para confirmação | ID exato | Adicionar, manter ou ajustar |

3. **Metas a registrar no dashboard**. Escreva **Nenhuma meta de sucesso verificável** quando for o caso. Caso contrário, forneça uma linha para cada meta, com os valores prontos para copiar.

   | Nome exato | Tipo na UI | Campos e valores | Quando conta | Ação e prontidão |
   | --- | --- | --- | --- | --- |
   | Nome que será salvo | Rótulo da interface | Somente os campos do tipo escolhido | Sinal observado | Criar, manter ou ajustar. Pronta, depende da marcação ou suporte pendente de verificação |

4. **Instalação e validação**. Informe onde colocar o script, o que aplicar no CMS, quais testes foram executados e quais ainda dependem de acesso. Se existem apenas métricas de interação, diga quais o operador já pode acompanhar.
