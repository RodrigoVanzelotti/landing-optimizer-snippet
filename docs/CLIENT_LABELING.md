# Onboarding de clientes do Landing Optimizer

No site do cliente, você só precisa de acesso ao campo de código do `<head>` e aos atributos HTML dos elementos que o editor permite marcar. As metas são configuradas no painel.

## 1. Identifique o resultado e a confirmação que já existem

Percorra o fluxo publicado com dados de teste autorizados. Anote a rota de entrada, a ação e o que aparece depois de um sucesso. Teste também uma falha para distinguir as duas respostas.

| O fluxo existente mostra | Escolha no painel |
| --- | --- |
| Página exclusiva de sucesso, como `/obrigado` | **Página de confirmação**. Use o caminho exato e instale o script também nessa página. |
| Um elemento exclusivo de sucesso aparece na mesma rota | **Elemento de confirmação**. Confirme que o editor permite marcar esse elemento. |
| Apenas clique, tentativa de envio ou confirmação inacessível | Acompanhe o clique ou envio nas métricas de interação. Registre a confirmação como indisponível. |

Use uma rota exclusiva de sucesso. Visitar diretamente uma URL configurada também corresponde à meta, então caminhos públicos de uso geral, como `/cadastro`, não servem como confirmação. Um checkout externo ou iframe de terceiros precisa expor um sinal acessível ao documento onde o script roda. Mudanças apenas nos parâmetros ou no fragmento da URL não contam como mudança de rota.

## 2. Instale o script do próprio site

1. Cadastre o domínio no dashboard e abra **Sites → Instalação do código**. Se o fluxo usa mais de uma origem, verifique quais já estão autorizadas e se o mesmo código pode ser instalado nas páginas relevantes.
2. Copie a tag `<script>` gerada para esse site. Cole-a uma vez no `<head>` compartilhado, de preferência no campo de código global do CMS.
3. Publique no CMS. Abra a página publicada e confira no navegador se o script carrega e envia `page_view`. Em sites com CSP, consulte **Orientações de segurança (CSP)** na tela de instalação. Use o campo que insere o script no documento principal.

## 3. Marque os elementos existentes

Aplique `data-lo-role` e `data-lo-id` nos CTAs, formulários e seções importantes que o editor permite alcançar. Mantenha links, estilos e comportamento da página.

| Papel | Onde aplicar |
| --- | --- |
| `navigation`, `footer` | Nos contêineres de navegação e rodapé |
| `hero`, `section` | No contêiner de abertura e nas demais seções relevantes |
| `heading` | No título ou subtítulo, de preferência um elemento só de texto |
| `cta` | No link ou botão que a pessoa aciona |
| `form` | No elemento `<form>` existente |
| `pricing`, `testimonials`, `faq` | Nos blocos de preços, prova social e perguntas frequentes |

O ID começa com letra minúscula e tem até 64 caracteres, usando apenas letras minúsculas, números e hífens. Escolha nomes estáveis e únicos no documento publicado. Dê IDs diferentes a cópias mobile e desktop, inclusive quando uma delas está escondida. Tente ficar em até 60 elementos mapeados por página. Ao adicionar qualquer `data-lo-role`, o SDK entra em modo manual na página inteira. Marque os elementos de interesse, especialmente CTAs e formulários, antes de publicar. Uma página sem papéis usa descoberta automática. IDs de elementos de confirmação podem ser adicionados sem configurar um papel.

Mantendo os elementos e estados que o site já possui, a marcação pode ficar assim:

```html
<a href="/cadastro" data-lo-role="cta" data-lo-id="hero-cadastro">Criar conta</a>
<form data-lo-role="form" data-lo-id="cadastro-form">…</form>
<p data-lo-id="cadastro-confirmado" hidden>Cadastro concluído.</p>
```

O último exemplo representa uma confirmação que o próprio site já torna visível após o sucesso. No CMS, só adicione o atributo ao elemento existente. Se o mesmo elemento exibe erro, carregamento e sucesso, procure um elemento dedicado ou use a rota de sucesso. Mantenha campos e dados pessoais fora das marcações e dos textos mapeados. Use `data-lo-ignore` em áreas sensíveis. Elementos ignorados também ficam de fora da detecção de confirmação.

## 4. Cadastre a meta no dashboard

Na tela de instalação, vá até **Metas de conversão** e escolha um nome estável, como `cadastro_concluido`.

- Para **Página de confirmação**, selecione **Exatamente igual** e informe o caminho final, por exemplo `/obrigado`.
- Para **Elemento de confirmação**, informe o caminho em que a ação acontece, por exemplo `/cadastro`, e o ID da confirmação, por exemplo `cadastro-confirmado`. Se existir um formulário nativo dedicado, informe também seu ID, por exemplo `cadastro-form`. Sem o ID de formulário, o SDK passa a observar a confirmação após um clique em um controle interativo ou envio nessa rota. Com o ID, ele observa após o envio daquele formulário. O elemento precisa estar ausente ou oculto no momento da ação e aparecer nessa rota em até dois minutos. Salve e reabra a página para o script carregar a configuração atualizada.
- Para uma tentativa, prefira as métricas de interação existentes. **Tentativa de envio**, em **Avançado**, também pode ser usada como meta intermediária quando essa métrica for intencional. **Evento personalizado** atende integrações com JavaScript próprio já existente. O onboarding padrão usa os sinais que a página já fornece.

Escolha a meta que representa o resultado do negócio como **meta principal** dos experimentos que devem medir esse resultado. As metas se aplicam a eventos futuros.

## 5. Valide o onboarding na página publicada

1. Abra a página em desktop e mobile. Confira os atributos no DOM publicado e teste se o botão e o formulário continuam funcionando. O validador em [validate-labels.js](../.agents/skills/label-landing-page/scripts/validate-labels.js) pode ajudar na inspeção das marcações.
2. Verifique `page_view`, `page_map` e a interação esperada nas requisições para a API. Ao navegar sem recarga, confira se o novo caminho recebe visualização e mapa próprios. Uma resposta de ingestão confirma o recebimento, então verifique também os dados persistidos no dashboard.
3. Execute uma tentativa que falha e uma que funciona, usando um ambiente ou dados de teste autorizados. A falha deve gerar zero conversões. No teste de sucesso, confirme que a meta registrou uma conversão. Para confirmação na mesma página, verifique também que uma mensagem já visível ao abrir a página ou a repetição da mesma renderização não acrescenta outra conversão.
4. Se houver um experimento de homologação, selecione a meta principal e confira a atribuição à variante exposta. Registre o domínio, as páginas verificadas, as tags, a meta escolhida e qualquer fluxo cuja confirmação ficou indisponível.

## Referência para manutenção

- Os rótulos geram seletores estáveis como `[data-lo-id="hero-cadastro"]`. Use esse formato exato nos alvos de experimentos. Para mudanças de texto, prefira um alvo só de texto, pois `set_text` substitui os elementos filhos.
- `cta_click` registra a interação e `form_submit` registra a tentativa. Chegar à URL configurada ou exibir um elemento dedicado é o sinal de sucesso observado pelo produto.
- Mudanças de ID não migram relatórios, metas ou experimentos existentes. Revise os seletores antes de renomear tags.
- A detecção de confirmação atua no documento do script. Conteúdo em iframes externos, Shadow DOM e confirmações que só existem no servidor ficam fora desse fluxo.
