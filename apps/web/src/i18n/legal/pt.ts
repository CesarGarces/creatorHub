import type { LegalDocuments } from "./types";

export const pt: LegalDocuments = {
  privacy: {
    title: "Política de Privacidade",
    sections: [
      {
        title: "1. Introdução",
        blocks: [
          {
            type: "p",
            text: "Boas-vindas ao Creator Hub (“nós”, “nosso”). Temos o compromisso de proteger suas informações pessoais e seu direito à privacidade. Esta Política de Privacidade explica como coletamos, usamos, divulgamos e protegemos suas informações quando você visita nossa plataforma e usa nossos serviços.",
          },
        ],
      },
      {
        title: "2. Informações que coletamos",
        blocks: [
          { type: "h4", text: "Informações pessoais fornecidas por você" },
          {
            type: "ul",
            items: [
              "<b>Dados da conta:</b> nome, endereço de e-mail e credenciais criptografadas fornecidas no cadastro.",
              "<b>Estilo do criador e contexto RAG:</b> diretrizes de marca, preferências, roteiros anteriores ou contexto de estilo enviados por você para personalizar os resultados da IA.",
              "<b>Conteúdo do usuário:</b> prompts, roteiros, imagens, thumbnails e outros conteúdos criados ou enviados na plataforma.",
              "<b>Dados de pagamento e transações:</b> planos de assinatura, histórico de compras de créditos e saldo de créditos. O processamento dos pagamentos é feito diretamente por processadores terceirizados (por exemplo, Stripe, Mercado Pago); não armazenamos os dados completos dos cartões de pagamento.",
            ],
          },
          { type: "h4", text: "Informações coletadas automaticamente" },
          {
            type: "ul",
            items: [
              "Endereço IP, tipo de navegador, dados do dispositivo e sistema operacional.",
              "Análises de uso, interação com recursos, páginas visitadas e origens de acesso.",
            ],
          },
        ],
      },
      {
        title: "3. Como usamos suas informações",
        blocks: [
          {
            type: "ul",
            items: [
              "Fornecer, manter e personalizar nossas ferramentas e serviços para criadores com IA.",
              "Processar transações, gerenciar saldos de créditos e enviar recibos de cobrança.",
              "Gerenciar as integrações do bot da comunidade e a automação de fluxos de trabalho.",
              "Melhorar a funcionalidade, a segurança e o desempenho da plataforma por meio de análises.",
              "Enviar atualizações administrativas, alertas de segurança e respostas do suporte ao cliente.",
              "Cumprir obrigações legais e regulatórias.",
            ],
          },
        ],
      },
      {
        title:
          "4. Compartilhamento de informações e fornecedores terceirizados",
        blocks: [
          {
            type: "p",
            text: "Não vendemos seus dados pessoais. Compartilhamos apenas os dados necessários com prestadores de serviços confiáveis:",
          },
          {
            type: "ul",
            items: [
              "<b>Provedores de modelos de IA:</b> prompts e arquivos de entrada são processados por endpoints de API seguros (por exemplo, OpenAI, Google Gemini e serviços de síntese de imagens). Os dados processados por essas APIs não são usados para treinar modelos fundacionais de terceiros.",
              "<b>Processadores de pagamento:</b> Stripe e Mercado Pago, para o processamento seguro das transações.",
              "<b>Hospedagem e infraestrutura:</b> hospedagem em nuvem (por exemplo, Vercel) e provedores de banco de dados.",
              "<b>Autoridades legais:</b> quando exigido pela legislação aplicável ou por solicitação governamental exequível.",
            ],
          },
        ],
      },
      {
        title: "5. Retenção de dados e exclusão da conta",
        blocks: [
          {
            type: "p",
            text: "Mantemos suas informações pessoais, seu histórico de uso de créditos e os resultados da IA enquanto sua conta estiver ativa. Você pode solicitar a exclusão completa da conta e dos dados a qualquer momento entrando em contato com o suporte. Com o encerramento da conta, os dados pessoais e o contexto de estilo associado serão apagados permanentemente ou anonimizados, ressalvada a retenção exigida pelas leis fiscais ou contábeis.",
          },
        ],
      },
      {
        title: "6. Seus direitos (GDPR / CCPA)",
        blocks: [
          {
            type: "p",
            text: "Dependendo da sua localização, você tem direito a:",
          },
          {
            type: "ul",
            items: [
              "Acessar, baixar ou transferir seus dados pessoais e o conteúdo gerado.",
              "Corrigir informações pessoais imprecisas.",
              "Solicitar a exclusão da sua conta e do seu contexto de criador (“direito ao esquecimento”).",
              "Restringir ou se opor a determinadas atividades de tratamento de dados.",
              "Retirar o consentimento a qualquer momento.",
            ],
          },
          {
            type: "p",
            text: "Para exercer qualquer um desses direitos, entre em contato pelo e-mail <email>privacy@creatorhubplatform.com</email>.",
          },
        ],
      },
      {
        title: "7. Cookies e rastreamento",
        blocks: [
          {
            type: "p",
            text: "Usamos cookies e armazenamento local para manter as sessões dos usuários, lembrar preferências e analisar o tráfego. Para mais informações, consulte nossa Política de Cookies.",
          },
        ],
      },
      {
        title: "8. Segurança",
        blocks: [
          {
            type: "p",
            text: "Adotamos medidas de segurança técnicas e organizacionais padrão do setor, incluindo criptografia em repouso e em trânsito, para proteger seus dados pessoais e o conteúdo gerado.",
          },
        ],
      },
      {
        title: "9. Transferências internacionais de dados",
        blocks: [
          {
            type: "p",
            text: "Seus dados podem ser transferidos e processados em servidores fora do seu país de residência. Garantimos que todas as transferências internacionais de dados cumpram a legislação de privacidade aplicável por meio de cláusulas contratuais padrão.",
          },
        ],
      },
      {
        title: "10. Privacidade de crianças",
        blocks: [
          {
            type: "p",
            text: "O Creator Hub não se destina a pessoas com menos de 13 anos (ou 16 na UE). Não coletamos intencionalmente dados pessoais de crianças.",
          },
        ],
      },
      {
        title: "11. Alterações nesta política",
        blocks: [
          {
            type: "p",
            text: "Podemos atualizar esta Política de Privacidade periodicamente. Alterações relevantes serão comunicadas por notificações na plataforma ou por e-mail antes de entrarem em vigor.",
          },
        ],
      },
      {
        title: "12. Fale conosco",
        blocks: [
          {
            type: "p",
            text: "Se tiver dúvidas ou solicitações sobre esta Política de Privacidade, entre em contato:",
          },
          {
            type: "contact",
            team: "Equipe jurídica do Creator Hub",
            emailLabel: "E-mail:",
          },
        ],
      },
    ],
  },
  terms: {
    title: "Termos de Serviço",
    sections: [
      {
        title: "1. Aceitação dos termos",
        blocks: [
          {
            type: "p",
            text: "Ao acessar ou usar o Creator Hub (“o Serviço”, “nós”, “nosso”), você concorda em ficar vinculado a estes Termos de Serviço (“Termos”). Se não concordar com estes Termos, você não poderá acessar nem usar o Serviço.",
          },
        ],
      },
      {
        title: "2. Descrição do serviço",
        blocks: [
          {
            type: "p",
            text: "O Creator Hub oferece softwares, fluxos de trabalho e ferramentas com IA para criadores de conteúdo, incluindo, entre outros, geração de roteiros, design de thumbnails, síntese de imagens, gerenciamento do estilo do usuário e do contexto RAG, sistemas de cobrança por créditos e integrações do bot da comunidade (“Ferramentas”).",
          },
        ],
      },
      {
        title: "3. Contas e cadastro",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Elegibilidade:</b> você deve ter pelo menos 13 anos (ou 16 na União Europeia) para criar uma conta.",
              "<b>Exatidão:</b> você concorda em fornecer informações de cadastro precisas e completas.",
              "<b>Segurança:</b> você é responsável por manter a confidencialidade das credenciais da sua conta e por todas as atividades realizadas nela.",
              "<b>Uso não autorizado:</b> você deve nos avisar imediatamente pelo e-mail <email>privacy@creatorhubplatform.com</email> caso suspeite de acesso não autorizado à sua conta.",
            ],
          },
        ],
      },
      {
        title: "4. Assinaturas, pagamentos e reembolsos",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Cobrança:</b> o acesso a determinados recursos e cotas de créditos exige uma assinatura paga ou uma compra avulsa.",
              "<b>Processadores de pagamento:</b> os pagamentos são processados com segurança por gateways de pagamento terceirizados (por exemplo, Stripe, Mercado Pago). Não armazenamos nem processamos os dados completos de cartões de crédito.",
              "<b>Renovação automática:</b> os planos de assinatura são renovados automaticamente ao final de cada ciclo de cobrança, a menos que sejam cancelados antes da data de renovação.",
              "<b>Política de reembolso:</b> compras e recargas de créditos não são reembolsáveis depois que os créditos forem consumidos total ou parcialmente, exceto quando exigido pela legislação aplicável.",
            ],
          },
        ],
      },
      {
        title: "5. Sistema de créditos e uso justo",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Consumo de créditos:</b> as ferramentas da plataforma consomem créditos de acordo com a complexidade computacional (por exemplo, geração de texto versus renderização de imagens). O custo em créditos de cada ação é exibido na plataforma e pode ser ajustado mediante aviso prévio.",
              "<b>Expiração e exclusões:</b> salvo indicação expressa no seu plano de assinatura, os créditos mensais não são acumulados para os próximos ciclos de cobrança e expiram ao final de cada ciclo.",
              "<b>Ajustes:</b> o Creator Hub se reserva o direito de ajustar os preços ou as cotas de créditos para refletir os custos operacionais das APIs utilizadas.",
            ],
          },
        ],
      },
      {
        title: "6. Conteúdo do usuário e propriedade intelectual",
        blocks: [
          { type: "h4", text: "Sua titularidade e concessão de licença" },
          {
            type: "ul",
            items: [
              "<b>Dados enviados por você:</b> você mantém todos os direitos de propriedade sobre os textos, guias de estilo, ativos de marca e prompts que envia ao Serviço (“Conteúdo do usuário”).",
              "<b>Licença ao Creator Hub:</b> você concede ao Creator Hub uma licença não exclusiva, mundial e isenta de royalties para hospedar, armazenar, executar e exibir seu Conteúdo do usuário <b>exclusivamente</b> para operar, renderizar e fornecer o Serviço a você. Não vendemos seu conteúdo nem usamos seus dados privados para treinar modelos públicos de IA de terceiros.",
            ],
          },
          { type: "h4", text: "Resultados gerados por IA" },
          {
            type: "ul",
            items: [
              "<b>Titularidade do conteúdo gerado:</b> desde que você cumpra estes Termos e a legislação de direitos autorais aplicável, o Creator Hub cede a você todos os seus direitos, títulos e interesses sobre os resultados gerados para você pelas Ferramentas (“Conteúdo gerado”).",
              "<b>Restrições da IA de terceiros:</b> o Conteúdo gerado está sujeito aos termos dos provedores da infraestrutura de IA utilizada. Você reconhece que os resultados gerados por IA podem não ser exclusivos entre usuários diferentes e que a proteção de direitos autorais desses resultados varia conforme a jurisdição.",
            ],
          },
        ],
      },
      {
        title: "7. Política de uso aceitável",
        blocks: [
          { type: "p", text: "Você concorda em não usar o Serviço para:" },
          {
            type: "ul",
            items: [
              "Violar qualquer lei local, nacional ou internacional.",
              "Gerar, enviar ou distribuir conteúdo difamatório, de ódio, abusivo, ilegal ou que viole a propriedade intelectual ou a privacidade de terceiros.",
              "Fazer engenharia reversa, descompilar ou tentar extrair o código-fonte do Creator Hub.",
              "Fazer scraping, coletar dados ou usar bots automatizados não autorizados para contornar os limites da API ou o sistema de créditos (exceto os bots de comunidade oficiais oferecidos pelo Creator Hub).",
              "Abusar, sobrecarregar ou comprometer a integridade ou o desempenho da plataforma ou de sua infraestrutura.",
            ],
          },
        ],
      },
      {
        title: "8. Serviços e integrações de terceiros",
        blocks: [
          {
            type: "p",
            text: "O Serviço se integra a ferramentas, APIs e plataformas de comunidade de terceiros (por exemplo, provedores externos de LLM, redes sociais, webhooks). O Creator Hub não se responsabiliza pela disponibilidade, pelo tempo de atividade nem pelas práticas de privacidade desses serviços de terceiros.",
          },
        ],
      },
      {
        title: "9. Isenção de garantias",
        blocks: [
          {
            type: "p",
            text: "O SERVIÇO É FORNECIDO “NO ESTADO EM QUE SE ENCONTRA” E “CONFORME DISPONIBILIDADE”. O CREATOR HUB SE ISENTA DE TODAS AS GARANTIAS DE QUALQUER TIPO, EXPRESSAS OU IMPLÍCITAS, INCLUINDO, ENTRE OUTRAS, AS DE COMERCIALIZAÇÃO, ADEQUAÇÃO A UM FIM ESPECÍFICO E NÃO VIOLAÇÃO. NÃO GARANTIMOS QUE O CONTEÚDO GERADO POR IA SERÁ PRECISO, ININTERRUPTO OU LIVRE DE ERROS.",
          },
        ],
      },
      {
        title: "10. Limitação de responsabilidade",
        blocks: [
          {
            type: "p",
            text: "NA MÁXIMA EXTENSÃO PERMITIDA POR LEI, O CREATOR HUB E SUAS AFILIADAS NÃO SERÃO RESPONSÁVEIS POR QUAISQUER DANOS INDIRETOS, INCIDENTAIS, ESPECIAIS, CONSEQUENCIAIS OU PUNITIVOS, INCLUINDO PERDA DE LUCROS, DADOS OU FUNDO DE COMÉRCIO, DECORRENTES DO USO OU DA IMPOSSIBILIDADE DE USO DO SERVIÇO.",
          },
        ],
      },
      {
        title: "11. Indenização",
        blocks: [
          {
            type: "p",
            text: "Você concorda em indenizar e isentar de responsabilidade o Creator Hub, sua equipe e suas afiliadas por quaisquer reclamações, responsabilidades, danos ou despesas legais decorrentes do seu Conteúdo do usuário, do uso indevido do Conteúdo gerado ou da violação destes Termos.",
          },
        ],
      },
      {
        title: "12. Suspensão e encerramento da conta",
        blocks: [
          {
            type: "p",
            text: "Reservamo-nos o direito de suspender ou encerrar seu acesso ao Serviço imediatamente, sem aviso prévio, caso você viole estes Termos ou realize atividades fraudulentas, abusivas ou não autorizadas com créditos. Após o encerramento, os créditos não utilizados serão perdidos.",
          },
        ],
      },
      {
        title: "13. Lei aplicável",
        blocks: [
          {
            type: "p",
            text: "Estes Termos serão regidos e interpretados de acordo com a legislação aplicável, sem considerar os princípios de conflito de leis. Qualquer ação ou processo judicial deverá ser proposto perante os tribunais competentes da sua jurisdição operacional.",
          },
        ],
      },
      {
        title: "14. Alterações nos termos",
        blocks: [
          {
            type: "p",
            text: "Podemos revisar estes Termos periodicamente. Alterações relevantes serão notificadas por avisos no aplicativo ou por e-mail com pelo menos 30 dias de antecedência. O uso contínuo do Creator Hub constitui aceitação dos Termos atualizados.",
          },
        ],
      },
      {
        title: "15. Informações de contato",
        blocks: [
          {
            type: "p",
            text: "Para dúvidas ou consultas jurídicas sobre estes Termos, entre em contato:",
          },
          {
            type: "contact",
            team: "Equipe jurídica do Creator Hub",
            emailLabel: "E-mail:",
          },
        ],
      },
    ],
  },
  cookies: {
    title: "Política de Cookies",
    sections: [
      {
        title: "1. O que são cookies e armazenamento local?",
        blocks: [
          {
            type: "p",
            text: "Cookies são pequenos arquivos de texto salvos no seu dispositivo (computador, tablet ou celular) quando você visita sites. Além dos cookies, o Creator Hub (“nós”, “nosso”) utiliza tecnologias padrão de armazenamento do navegador, como o <b>Local Storage</b> e o <b>Session Storage</b> (em conjunto, “Tecnologias de armazenamento”), para garantir o bom funcionamento do serviço, a autenticação e as preferências do usuário.",
          },
        ],
      },
      {
        title: "2. Como usamos as tecnologias de armazenamento",
        blocks: [
          {
            type: "p",
            text: "Usamos cookies e armazenamento do navegador para as seguintes finalidades:",
          },
          {
            type: "ul",
            items: [
              "<b>Essenciais e de segurança:</b> necessários para o funcionamento básico do serviço, a autenticação dos usuários, a persistência da sessão e a proteção contra falsificação de solicitações entre sites (CSRF).",
              "<b>Preferências e estado:</b> lembram suas configurações de interface, o idioma da interface, o tema (modo claro/escuro), as preferências de exibição do saldo de créditos e rascunhos temporários de roteiros ou do editor.",
              "<b>Análises e desempenho:</b> ajudam a entender o tráfego de usuários, a latência do aplicativo e o desempenho da plataforma para melhorar os recursos (por exemplo, Vercel Analytics, Google Analytics).",
              "<b>Pagamentos e prevenção de fraudes:</b> inseridos pelos processadores de pagamento durante o checkout para garantir transações seguras e evitar estornos fraudulentos.",
            ],
          },
        ],
      },
      {
        title: "3. Tecnologias de armazenamento usadas pelo Creator Hub",
        blocks: [
          {
            type: "table",
            headers: ["Categoria", "Método / Nome", "Finalidade", "Duração"],
            rows: [
              [
                "<b>Autenticação</b>",
                "Token de sessão / autenticação",
                "Mantém você conectado com segurança e gerencia as solicitações ativas à API",
                "Sessão / 30 dias",
              ],
              [
                "<b>Segurança</b>",
                "Token CSRF",
                "Protege contra falsificação de solicitações entre sites não autorizada",
                "Sessão",
              ],
              [
                "<b>Preferências</b>",
                "<code>theme</code>, <code>creator_settings</code>",
                "Lembra suas preferências de interface e o layout do espaço de trabalho",
                "1 ano (Local Storage)",
              ],
              [
                "<b>Preferências</b>",
                "<code>ch_locale</code>",
                "Lembra o idioma da interface",
                "1 ano",
              ],
              [
                "<b>Análises</b>",
                "Vercel Analytics",
                "Mede a capacidade de resposta das páginas, o desempenho e os registros de erros",
                "1 ano",
              ],
              [
                "<b>Análises</b>",
                "Google Analytics (<code>_ga</code>, <code>_gid</code>)",
                "Acompanha métricas de uso, visualizações de página e adoção de recursos",
                "Até 2 anos",
              ],
              [
                "<b>Pagamentos</b>",
                "Cookies do Stripe / gateway de pagamento",
                "Viabiliza a compra segura de créditos e a detecção de fraudes",
                "Sessão / 1 ano",
              ],
            ],
          },
        ],
      },
      {
        title: "4. Serviços de terceiros",
        blocks: [
          {
            type: "p",
            text: "Contamos com prestadores de serviços terceirizados confiáveis que podem inserir cookies ou acessar o armazenamento do navegador quando você interage com o Creator Hub:",
          },
          {
            type: "ul",
            items: [
              "<b>Vercel Analytics:</b> monitoramento de desempenho e confiabilidade.",
              "<b>Google Analytics:</b> análise de tráfego e estatísticas agregadas sobre a navegação dos usuários.",
              "<b>Gateways de pagamento (Stripe / Mercado Pago):</b> prevenção de fraudes e processamento seguro do checkout.",
            ],
          },
        ],
      },
      {
        title: "5. Suas opções e controles de cookies",
        blocks: [
          {
            type: "ul",
            href: "https://tools.google.com/dlpage/gaoptout",
            items: [
              "<b>Configurações do navegador:</b> a maioria dos navegadores permite gerenciar, bloquear ou excluir cookies e limpar o Local Storage nas preferências ou configurações.",
              "<b>Armazenamento essencial:</b> desativar os cookies essenciais ou o armazenamento local pode impedir que você faça login ou use os recursos do Creator Hub.",
              "<b>Desativação das análises:</b> você pode desativar o rastreamento do Google Analytics em todos os sites instalando o <link>complemento do navegador para desativação do Google Analytics</link>.",
            ],
          },
        ],
      },
      {
        title: "6. Consentimento e banner de cookies",
        blocks: [
          {
            type: "p",
            text: "Quando você acessa o Creator Hub pela primeira vez, um banner de cookies informa sobre o uso das Tecnologias de armazenamento. Os cookies essenciais são carregados automaticamente para permitir o funcionamento básico da plataforma. Ao continuar usando a plataforma ou aceitar os cookies não essenciais pelo banner, você consente com o uso dessas tecnologias conforme descrito nesta política.",
          },
        ],
      },
      {
        title: "7. Sinais “Do Not Track” (DNT)",
        blocks: [
          {
            type: "p",
            text: "Alguns navegadores incluem a opção “Não rastrear” (Do Not Track). Como ainda não há padrões uniformes e amplamente adotados para o cumprimento do DNT, o Creator Hub atualmente não responde a esses sinais.",
          },
        ],
      },
      {
        title: "8. Alterações nesta Política de Cookies",
        blocks: [
          {
            type: "p",
            text: "Podemos atualizar esta Política de Cookies para refletir mudanças técnicas, operacionais ou legais. Avisaremos os usuários sobre qualquer atualização relevante publicando a versão revisada com uma nova data de “Última atualização”.",
          },
        ],
      },
      {
        title: "9. Fale conosco",
        blocks: [
          {
            type: "p",
            text: "Se tiver dúvidas ou preocupações sobre o uso de cookies e armazenamento local, entre em contato:",
          },
          {
            type: "contact",
            team: "Equipe jurídica e de privacidade do Creator Hub",
            emailLabel: "E-mail:",
          },
        ],
      },
    ],
  },
};
