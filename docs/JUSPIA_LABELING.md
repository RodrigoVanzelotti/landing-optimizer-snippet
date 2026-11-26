# Marcação do JuspIA

Use o mesmo snippet em [juspia.com](https://juspia.com/) e [/cadastro](https://juspia.com/cadastro). Se as rotas compartilham o <head>, instale uma vez nesse template.

## Home

| Onde | data-lo-role | data-lo-id |
| --- | --- | --- |
| Navegação do topo | navigation | main-navigation |
| Entrar e Começar agora | cta | nav-login, nav-signup |
| Seção de abertura | hero | main-hero |
| Título e subtítulo da abertura | heading | hero-headline, hero-subheadline |
| Contador de advogados e seção de depoimentos | testimonials | hero-adoption-proof, customer-testimonials |
| Comparação, catálogo, três passos e faixa final | section | ai-comparison, legal-tools, how-it-works, closing-signup |
| Preços e cartão Ilimitado | pricing | main-pricing, unlimited-plan |
| Botões de cadastro na abertura, catálogo, depoimentos, preços e faixa final | cta | hero-signup, tools-signup, testimonials-signup, unlimited-subscribe, closing-signup-button |
| Seção de FAQ e link para todas as perguntas | faq / cta | main-faq / faq-view-all |
| Rodapé e grupos Produto e Empresa | footer / navigation | main-footer / footer-product-navigation, footer-company-navigation |
| Instagram e WhatsApp do rodapé e WhatsApp flutuante | cta | footer-instagram, footer-whatsapp, floating-whatsapp |

## Cadastro

| Onde | data-lo-role | data-lo-id |
| --- | --- | --- |
| Título e subtítulo | heading | signup-headline, signup-subheadline |
| Formulário | form | signup-form |
| Criar conta, Continuar com Google e Entrar | cta | signup-submit, signup-google, signup-login |

Aplique os dois atributos em cada elemento indicado. Marque os CTAs diretamente no link ou botão. Deixe os campos individuais sem marcação. Se houver cópias desktop e mobile, use IDs distintos, como hero-subheadline-desktop e hero-subheadline-mobile.

**Teste rápido** — Clique num CTA da home e confirme que o SDK envia page_view e page_map do cadastro. Se o Next.js trocar de rota sem emitir esses eventos, faça o link de cadastro carregar um novo documento. Preserve o redirecionamento para /assinatura no botão do plano.
