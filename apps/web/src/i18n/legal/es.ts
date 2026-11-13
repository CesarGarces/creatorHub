import type { LegalDocuments } from "./types";

export const es: LegalDocuments = {
  privacy: {
    title: "Política de privacidad",
    sections: [
      {
        title: "1. Introducción",
        blocks: [
          {
            type: "p",
            text: "Te damos la bienvenida a Creator Hub («nosotros», «nuestro»). Nos comprometemos a proteger tu información personal y tu derecho a la privacidad. Esta Política de privacidad explica cómo recopilamos, usamos, divulgamos y protegemos tu información cuando visitas nuestra plataforma y usas nuestros servicios.",
          },
        ],
      },
      {
        title: "2. Información que recopilamos",
        blocks: [
          { type: "h4", text: "Información personal que nos proporcionas" },
          {
            type: "ul",
            items: [
              "<b>Datos de la cuenta:</b> nombre, dirección de correo electrónico y credenciales cifradas proporcionadas durante el registro.",
              "<b>Estilo del creador y contexto RAG:</b> pautas de marca, preferencias, guiones anteriores o contexto de estilo que subes para personalizar los resultados de la IA.",
              "<b>Contenido del usuario:</b> prompts, guiones, imágenes, miniaturas y otro contenido creado o subido en la plataforma.",
              "<b>Datos de pagos y transacciones:</b> planes de suscripción, historial de compras de créditos y saldo de créditos. El procesamiento de pagos lo gestionan directamente procesadores externos (p. ej., Stripe, Mercado Pago); no almacenamos los datos completos de las tarjetas de pago.",
            ],
          },
          { type: "h4", text: "Información recopilada automáticamente" },
          {
            type: "ul",
            items: [
              "Dirección IP, tipo de navegador, datos del dispositivo y sistema operativo.",
              "Analíticas de uso, interacción con funciones, páginas visitadas y fuentes de referencia.",
            ],
          },
        ],
      },
      {
        title: "3. Cómo usamos tu información",
        blocks: [
          {
            type: "ul",
            items: [
              "Proporcionar, mantener y personalizar nuestras herramientas y servicios para creadores basados en IA.",
              "Procesar transacciones, gestionar saldos de créditos y enviar recibos de facturación.",
              "Gestionar las integraciones del bot de comunidad y la automatización de flujos de trabajo.",
              "Mejorar la funcionalidad, la seguridad y el rendimiento de la plataforma mediante analíticas.",
              "Enviar actualizaciones administrativas, alertas de seguridad y respuestas de soporte al cliente.",
              "Cumplir con las obligaciones legales y regulatorias.",
            ],
          },
        ],
      },
      {
        title: "4. Cómo compartimos tu información y proveedores externos",
        blocks: [
          {
            type: "p",
            text: "No vendemos tus datos personales. Solo compartimos los datos necesarios con proveedores de servicios de confianza:",
          },
          {
            type: "ul",
            items: [
              "<b>Proveedores de modelos de IA:</b> los prompts y archivos de entrada se procesan mediante endpoints de API seguros (p. ej., OpenAI, Google Gemini y servicios de síntesis de imágenes). Los datos procesados mediante estas API no se usan para entrenar modelos fundacionales de terceros.",
              "<b>Procesadores de pagos:</b> Stripe y Mercado Pago, para gestionar las transacciones de forma segura.",
              "<b>Alojamiento e infraestructura:</b> alojamiento en la nube (p. ej., Vercel) y proveedores de bases de datos.",
              "<b>Autoridades legales:</b> cuando lo exija la ley aplicable o una solicitud gubernamental ejecutable.",
            ],
          },
        ],
      },
      {
        title: "5. Conservación de datos y eliminación de la cuenta",
        blocks: [
          {
            type: "p",
            text: "Conservamos tu información personal, tu historial de uso de créditos y los resultados de la IA mientras tu cuenta permanezca activa. Puedes solicitar la eliminación completa de tu cuenta y tus datos en cualquier momento contactando con soporte. Al cerrarse la cuenta, los datos personales y el contexto de estilo asociado se borrarán de forma permanente o se anonimizarán, salvo la conservación exigida por las leyes fiscales o contables.",
          },
        ],
      },
      {
        title: "6. Tus derechos (RGPD / CCPA)",
        blocks: [
          { type: "p", text: "Según tu ubicación, tienes derecho a:" },
          {
            type: "ul",
            items: [
              "Acceder, descargar o transferir tus datos personales y el contenido generado.",
              "Rectificar información personal inexacta.",
              "Solicitar la supresión de tu cuenta y de tu contexto de creador («derecho al olvido»).",
              "Limitar u oponerte a determinadas actividades de tratamiento de datos.",
              "Retirar tu consentimiento en cualquier momento.",
            ],
          },
          {
            type: "p",
            text: "Para ejercer cualquiera de estos derechos, escríbenos a <email>privacy@creatorhubplatform.com</email>.",
          },
        ],
      },
      {
        title: "7. Cookies y seguimiento",
        blocks: [
          {
            type: "p",
            text: "Usamos cookies y almacenamiento local para mantener las sesiones de los usuarios, recordar preferencias y analizar el tráfico. Para más información, consulta nuestra Política de cookies.",
          },
        ],
      },
      {
        title: "8. Seguridad",
        blocks: [
          {
            type: "p",
            text: "Aplicamos medidas de seguridad técnicas y organizativas estándar del sector, incluido el cifrado en reposo y en tránsito, para proteger tus datos personales y el contenido generado.",
          },
        ],
      },
      {
        title: "9. Transferencias internacionales de datos",
        blocks: [
          {
            type: "p",
            text: "Tus datos pueden transferirse y procesarse en servidores ubicados fuera de tu país de residencia. Garantizamos que todas las transferencias internacionales de datos cumplan con la normativa de privacidad aplicable mediante cláusulas contractuales tipo.",
          },
        ],
      },
      {
        title: "10. Privacidad de los menores",
        blocks: [
          {
            type: "p",
            text: "Creator Hub no está destinado a personas menores de 13 años (o de 16 en la UE). No recopilamos deliberadamente datos personales de menores.",
          },
        ],
      },
      {
        title: "11. Cambios en esta política",
        blocks: [
          {
            type: "p",
            text: "Podemos actualizar esta Política de privacidad periódicamente. Los cambios importantes se comunicarán mediante notificaciones en la plataforma o por correo electrónico antes de que entren en vigor.",
          },
        ],
      },
      {
        title: "12. Contacto",
        blocks: [
          {
            type: "p",
            text: "Si tienes preguntas o solicitudes sobre esta Política de privacidad, contáctanos en:",
          },
          {
            type: "contact",
            team: "Equipo legal de Creator Hub",
            emailLabel: "Correo electrónico:",
          },
        ],
      },
    ],
  },
  terms: {
    title: "Términos del servicio",
    sections: [
      {
        title: "1. Aceptación de los términos",
        blocks: [
          {
            type: "p",
            text: "Al acceder o usar Creator Hub («el Servicio», «nosotros», «nuestro»), aceptas quedar vinculado por estos Términos del servicio («Términos»). Si no estás de acuerdo con estos Términos, no puedes acceder al Servicio ni usarlo.",
          },
        ],
      },
      {
        title: "2. Descripción del servicio",
        blocks: [
          {
            type: "p",
            text: "Creator Hub ofrece software, flujos de trabajo y herramientas basados en IA para creadores de contenido, incluidos, entre otros, la generación de guiones, el diseño de miniaturas, la síntesis de imágenes, la gestión del estilo del usuario y del contexto RAG, sistemas de facturación por créditos e integraciones del bot de comunidad («Herramientas»).",
          },
        ],
      },
      {
        title: "3. Cuentas y registro",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Requisitos:</b> debes tener al menos 13 años (o 16 en la Unión Europea) para crear una cuenta.",
              "<b>Exactitud:</b> te comprometes a proporcionar información de registro exacta y completa.",
              "<b>Seguridad:</b> eres responsable de mantener la confidencialidad de las credenciales de tu cuenta y de todas las actividades realizadas con ella.",
              "<b>Uso no autorizado:</b> debes avisarnos de inmediato en <email>privacy@creatorhubplatform.com</email> si sospechas de un acceso no autorizado a tu cuenta.",
            ],
          },
        ],
      },
      {
        title: "4. Suscripciones, pagos y reembolsos",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Facturación:</b> el acceso a determinadas funciones y asignaciones de créditos requiere una suscripción de pago o una compra de pago por uso.",
              "<b>Procesadores de pagos:</b> los pagos se gestionan de forma segura a través de pasarelas de pago externas (p. ej., Stripe, Mercado Pago). No almacenamos ni procesamos los datos completos de las tarjetas de crédito.",
              "<b>Renovación automática:</b> los planes de suscripción se renuevan automáticamente al final de cada ciclo de facturación, salvo que se cancelen antes de la fecha de renovación.",
              "<b>Política de reembolsos:</b> las compras y recargas de créditos no son reembolsables una vez que los créditos se han consumido total o parcialmente, salvo cuando lo exija la ley aplicable.",
            ],
          },
        ],
      },
      {
        title: "5. Sistema de créditos y uso razonable",
        blocks: [
          {
            type: "ul",
            items: [
              "<b>Consumo de créditos:</b> las herramientas de la plataforma consumen créditos según la complejidad de cómputo (p. ej., generación de texto frente a renderizado de imágenes). El coste en créditos de cada acción se muestra en la plataforma y puede ajustarse con aviso previo.",
              "<b>Vencimiento y exclusiones:</b> salvo que tu plan de suscripción indique lo contrario, los créditos mensuales no se acumulan para los siguientes periodos de facturación y vencen al final de cada ciclo.",
              "<b>Ajustes:</b> Creator Hub se reserva el derecho de ajustar los precios o las asignaciones de créditos para reflejar los costes operativos de las API subyacentes.",
            ],
          },
        ],
      },
      {
        title: "6. Contenido del usuario y propiedad intelectual",
        blocks: [
          { type: "h4", text: "Tu titularidad y concesión de licencia" },
          {
            type: "ul",
            items: [
              "<b>Datos que aportas:</b> conservas todos los derechos de propiedad sobre los textos, guías de estilo, recursos de marca y prompts que subes al Servicio («Contenido del usuario»).",
              "<b>Licencia a Creator Hub:</b> concedes a Creator Hub una licencia no exclusiva, mundial y libre de regalías para alojar, almacenar, ejecutar y mostrar tu Contenido del usuario <b>únicamente</b> con el fin de operar, renderizar y prestarte el Servicio. No vendemos tu contenido ni usamos tus datos privados para entrenar modelos de IA públicos de terceros.",
            ],
          },
          { type: "h4", text: "Resultados generados por IA" },
          {
            type: "ul",
            items: [
              "<b>Titularidad del contenido generado:</b> siempre que cumplas estos Términos y la legislación de derechos de autor aplicable, Creator Hub te cede todos sus derechos, títulos e intereses sobre los resultados que las Herramientas generen para ti («Contenido generado»).",
              "<b>Limitaciones de la IA de terceros:</b> el Contenido generado está sujeto a los términos de los proveedores de la infraestructura de IA subyacente. Reconoces que los resultados generados por IA pueden no ser únicos entre distintos usuarios y que la protección de derechos de autor de dichos resultados varía según la jurisdicción.",
            ],
          },
        ],
      },
      {
        title: "7. Política de uso aceptable",
        blocks: [
          { type: "p", text: "Te comprometes a no usar el Servicio para:" },
          {
            type: "ul",
            items: [
              "Infringir cualquier ley local, nacional o internacional.",
              "Generar, subir o distribuir contenido difamatorio, de odio, abusivo, ilegal o que vulnere la propiedad intelectual o la privacidad de terceros.",
              "Aplicar ingeniería inversa, descompilar o intentar extraer el código fuente de Creator Hub.",
              "Hacer scraping, recopilar datos o usar bots automatizados no autorizados para eludir los límites de la API o el sistema de créditos (excepto los bots de comunidad oficiales que ofrece Creator Hub).",
              "Abusar, sobrecargar o alterar la integridad o el rendimiento de la plataforma o de su infraestructura.",
            ],
          },
        ],
      },
      {
        title: "8. Servicios e integraciones de terceros",
        blocks: [
          {
            type: "p",
            text: "El Servicio se integra con herramientas, API y plataformas de comunidad de terceros (p. ej., proveedores externos de LLM, canales sociales, webhooks). Creator Hub no se hace responsable de la disponibilidad, el tiempo de actividad ni las prácticas de privacidad de estos servicios de terceros.",
          },
        ],
      },
      {
        title: "9. Exclusión de garantías",
        blocks: [
          {
            type: "p",
            text: "EL SERVICIO SE PRESTA «TAL CUAL» Y «SEGÚN DISPONIBILIDAD». CREATOR HUB RENUNCIA A TODA GARANTÍA DE CUALQUIER TIPO, EXPRESA O IMPLÍCITA, INCLUIDAS, ENTRE OTRAS, LAS DE COMERCIABILIDAD, IDONEIDAD PARA UN FIN DETERMINADO Y NO INFRACCIÓN. NO GARANTIZAMOS QUE EL CONTENIDO GENERADO POR IA SEA EXACTO, ININTERRUMPIDO O ESTÉ LIBRE DE ERRORES.",
          },
        ],
      },
      {
        title: "10. Limitación de responsabilidad",
        blocks: [
          {
            type: "p",
            text: "EN LA MÁXIMA MEDIDA PERMITIDA POR LA LEY, CREATOR HUB Y SUS AFILIADOS NO SERÁN RESPONSABLES DE NINGÚN DAÑO INDIRECTO, INCIDENTAL, ESPECIAL, CONSECUENTE O PUNITIVO, INCLUIDA LA PÉRDIDA DE BENEFICIOS, DATOS O FONDO DE COMERCIO, DERIVADO DEL USO O DE LA IMPOSIBILIDAD DE USAR EL SERVICIO.",
          },
        ],
      },
      {
        title: "11. Indemnización",
        blocks: [
          {
            type: "p",
            text: "Aceptas indemnizar y eximir de responsabilidad a Creator Hub, a su equipo y a sus afiliados frente a cualquier reclamación, responsabilidad, daño o gasto legal derivado de tu Contenido del usuario, del uso indebido del Contenido generado o del incumplimiento de estos Términos.",
          },
        ],
      },
      {
        title: "12. Suspensión y cancelación de la cuenta",
        blocks: [
          {
            type: "p",
            text: "Nos reservamos el derecho de suspender o cancelar tu acceso al Servicio de inmediato y sin previo aviso si incumples estos Términos o realizas actividades fraudulentas, abusivas o no autorizadas con los créditos. Tras la cancelación, los créditos no utilizados se pierden.",
          },
        ],
      },
      {
        title: "13. Legislación aplicable",
        blocks: [
          {
            type: "p",
            text: "Estos Términos se regirán e interpretarán conforme a la legislación aplicable, sin tener en cuenta los principios de conflicto de leyes. Cualquier acción o procedimiento judicial se presentará ante los tribunales competentes de tu jurisdicción operativa.",
          },
        ],
      },
      {
        title: "14. Cambios en los términos",
        blocks: [
          {
            type: "p",
            text: "Podemos modificar estos Términos ocasionalmente. Los cambios importantes se notificarán mediante avisos en la aplicación o por correo electrónico al menos 30 días antes de su entrada en vigor. El uso continuado de Creator Hub implica la aceptación de los Términos actualizados.",
          },
        ],
      },
      {
        title: "15. Información de contacto",
        blocks: [
          {
            type: "p",
            text: "Si tienes preguntas o consultas legales sobre estos Términos, contáctanos en:",
          },
          {
            type: "contact",
            team: "Equipo legal de Creator Hub",
            emailLabel: "Correo electrónico:",
          },
        ],
      },
    ],
  },
  cookies: {
    title: "Política de cookies",
    sections: [
      {
        title: "1. ¿Qué son las cookies y el almacenamiento local?",
        blocks: [
          {
            type: "p",
            text: "Las cookies son pequeños archivos de texto que se guardan en tu dispositivo (ordenador, tableta o móvil) cuando visitas sitios web. Además de las cookies, Creator Hub («nosotros», «nuestro») utiliza tecnologías de almacenamiento estándar del navegador, como el <b>Local Storage</b> y el <b>Session Storage</b> (en conjunto, «Tecnologías de almacenamiento»), para garantizar el correcto funcionamiento del servicio, la autenticación y las preferencias del usuario.",
          },
        ],
      },
      {
        title: "2. Cómo usamos las tecnologías de almacenamiento",
        blocks: [
          {
            type: "p",
            text: "Usamos cookies y almacenamiento del navegador con los siguientes fines:",
          },
          {
            type: "ul",
            items: [
              "<b>Esenciales y de seguridad:</b> necesarias para el funcionamiento básico del servicio, la autenticación de usuarios, la persistencia de la sesión y la protección contra la falsificación de solicitudes entre sitios (CSRF).",
              "<b>Preferencias y estado:</b> recuerdan tu configuración de la interfaz, el idioma de la interfaz, el tema (modo claro/oscuro), las preferencias de visualización del saldo de créditos y los borradores temporales de guiones o del editor.",
              "<b>Analítica y rendimiento:</b> nos ayudan a entender el tráfico de usuarios, la latencia de la aplicación y el rendimiento de la plataforma para mejorar las funciones (p. ej., Vercel Analytics, Google Analytics).",
              "<b>Pagos y prevención del fraude:</b> las colocan los procesadores de pagos durante el proceso de compra para garantizar transacciones seguras y evitar contracargos fraudulentos.",
            ],
          },
        ],
      },
      {
        title: "3. Tecnologías de almacenamiento que usa Creator Hub",
        blocks: [
          {
            type: "table",
            headers: ["Categoría", "Método / Nombre", "Finalidad", "Duración"],
            rows: [
              [
                "<b>Autenticación</b>",
                "Token de sesión / autenticación",
                "Mantiene tu sesión iniciada de forma segura y gestiona las solicitudes activas a la API",
                "Sesión / 30 días",
              ],
              [
                "<b>Seguridad</b>",
                "Token CSRF",
                "Protege contra la falsificación de solicitudes entre sitios no autorizada",
                "Sesión",
              ],
              [
                "<b>Preferencias</b>",
                "<code>theme</code>, <code>creator_settings</code>",
                "Recuerda tus preferencias de interfaz y la disposición del espacio de trabajo",
                "1 año (Local Storage)",
              ],
              [
                "<b>Preferencias</b>",
                "<code>ch_locale</code>",
                "Recuerda el idioma de la interfaz",
                "1 año",
              ],
              [
                "<b>Analítica</b>",
                "Vercel Analytics",
                "Mide la capacidad de respuesta de las páginas, el rendimiento y los registros de errores",
                "1 año",
              ],
              [
                "<b>Analítica</b>",
                "Google Analytics (<code>_ga</code>, <code>_gid</code>)",
                "Mide métricas de uso, páginas vistas y adopción de funciones",
                "Hasta 2 años",
              ],
              [
                "<b>Pagos</b>",
                "Cookies de Stripe / pasarela de pago",
                "Facilita la compra segura de créditos y la detección de fraude",
                "Sesión / 1 año",
              ],
            ],
          },
        ],
      },
      {
        title: "4. Servicios de terceros",
        blocks: [
          {
            type: "p",
            text: "Trabajamos con proveedores externos de confianza que pueden colocar cookies o acceder al almacenamiento del navegador cuando interactúas con Creator Hub:",
          },
          {
            type: "ul",
            items: [
              "<b>Vercel Analytics:</b> supervisión del rendimiento y la fiabilidad.",
              "<b>Google Analytics:</b> análisis del tráfico y estadísticas agregadas del recorrido de los usuarios.",
              "<b>Pasarelas de pago (Stripe / Mercado Pago):</b> prevención del fraude y procesamiento seguro de pagos.",
            ],
          },
        ],
      },
      {
        title: "5. Tus opciones y controles sobre las cookies",
        blocks: [
          {
            type: "ul",
            href: "https://tools.google.com/dlpage/gaoptout",
            items: [
              "<b>Configuración del navegador:</b> la mayoría de los navegadores te permiten gestionar, bloquear o eliminar las cookies y borrar el Local Storage desde sus preferencias o configuración.",
              "<b>Almacenamiento esencial:</b> ten en cuenta que desactivar las cookies esenciales o el almacenamiento local puede impedirte iniciar sesión o usar las funciones de Creator Hub.",
              "<b>Exclusión de la analítica:</b> puedes desactivar el seguimiento de Google Analytics en todos los sitios web con el <link>complemento de inhabilitación para navegadores de Google Analytics</link>.",
            ],
          },
        ],
      },
      {
        title: "6. Consentimiento y banner de cookies",
        blocks: [
          {
            type: "p",
            text: "La primera vez que accedes a Creator Hub, un banner de cookies te informa sobre nuestro uso de las Tecnologías de almacenamiento. Las cookies esenciales se cargan automáticamente para permitir el funcionamiento básico de la plataforma. Si sigues usando la plataforma o aceptas las cookies no esenciales a través del banner, consientes el uso de estas tecnologías tal como se describe en esta política.",
          },
        ],
      },
      {
        title: "7. Señales «Do Not Track» (DNT)",
        blocks: [
          {
            type: "p",
            text: "Algunos navegadores incluyen la opción «No rastrear» (Do Not Track). Como aún no existen estándares uniformes y ampliamente adoptados para cumplir con DNT, Creator Hub no responde actualmente a estas señales.",
          },
        ],
      },
      {
        title: "8. Cambios en esta Política de cookies",
        blocks: [
          {
            type: "p",
            text: "Podemos actualizar esta Política de cookies para reflejar cambios técnicos, operativos o legales. Notificaremos a los usuarios cualquier actualización importante publicando la versión revisada con una nueva fecha de «Última actualización».",
          },
        ],
      },
      {
        title: "9. Contacto",
        blocks: [
          {
            type: "p",
            text: "Si tienes preguntas o inquietudes sobre nuestro uso de las cookies y el almacenamiento local, contáctanos en:",
          },
          {
            type: "contact",
            team: "Equipo legal y de privacidad de Creator Hub",
            emailLabel: "Correo electrónico:",
          },
        ],
      },
    ],
  },
};
