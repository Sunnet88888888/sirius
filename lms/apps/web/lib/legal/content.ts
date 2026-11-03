/**
 * Legal texts, in Russian (the binding version) and English (a translation).
 *
 * Placeholders: {name} {inn} {ogrnip} {address} {email} {site} are filled from lib/legal/operator.ts.
 * When the meaning of a text changes, bump LEGAL_VERSION in version.ts.
 * These are working drafts written from the platform's real behaviour; have a lawyer review them.
 */
import { OPERATOR, type Lang } from './operator'

export type DocKey = 'privacy' | 'terms' | 'consent' | 'offer' | 'contacts'

export type Section = { h?: string; p?: string[]; ul?: string[] }
export type LegalDoc = { title: string; sections: Section[] }

export const DOC_KEYS: DocKey[] = ['privacy', 'terms', 'consent', 'offer', 'contacts']

/** Fill the operator placeholders; an empty field shows as [field] so a draft is never mistaken for final. */
export function fill(text: string, lang: Lang): string {
  const values: Record<string, string> = {
    name: OPERATOR.name[lang],
    inn: OPERATOR.inn,
    ogrnip: OPERATOR.ogrnip,
    address: OPERATOR.address[lang],
    email: OPERATOR.email,
    site: OPERATOR.site,
  }
  return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] || `[${key}]`)
}

const ru: Record<DocKey, LegalDoc> = {
  privacy: {
    title: 'Политика в отношении обработки персональных данных',
    sections: [
      {
        h: '1. Общие положения',
        p: [
          'Оператор персональных данных — {name}, ИНН {inn}, ОГРНИП {ogrnip}, адрес: {address}, e-mail: {email} (далее — Оператор).',
          'Политика применяется к сайту https://{site} и образовательной платформе SIRIUS (далее — Платформа) и составлена в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».',
          'Используя Платформу, вы подтверждаете, что ознакомились с Политикой. Согласие на обработку персональных данных даётся отдельно при регистрации.',
        ],
      },
      {
        h: '2. Какие данные мы обрабатываем',
        ul: [
          'Данные аккаунта: адрес электронной почты, имя пользователя, имя и фамилия (если указаны), пароль в виде необратимого хеша (сам пароль мы не храним), аватар и описание профиля (по желанию).',
          'Учебные данные: прогресс по курсам, ответы на задания и тесты, отправленный программный код и результаты его проверки, оценки, сертификаты, комментарии и сообщения.',
          'Технические данные: IP-адрес, время входа, сведения о браузере и устройстве, просмотренные страницы и действия на Платформе (события собственной аналитики).',
          'При входе через Google: адрес электронной почты, имя и идентификатор аккаунта Google, которые Google передаёт по вашему разрешению.',
          'Платёжные данные: данные банковской карты мы не получаем и не храним, оплата проходит на стороне платёжного сервиса. Мы получаем только сведения о факте и сумме платежа.',
        ],
      },
      {
        h: '3. Цели обработки',
        ul: [
          'создание и обслуживание аккаунта, идентификация пользователя;',
          'предоставление доступа к курсам и материалам, учёт прогресса, выдача сертификатов;',
          'проверка заданий, в том числе автоматическая проверка кода и подсказки с помощью сервисов искусственного интеллекта;',
          'отправка служебных сообщений (восстановление пароля, ссылка для входа, уведомления о курсах);',
          'обеспечение безопасности, предотвращение злоупотреблений и взломов;',
          'статистика использования и улучшение Платформы;',
          'заключение и исполнение договоров, приём платежей и возвраты.',
        ],
      },
      {
        h: '4. Правовые основания',
        p: [
          'Обработка осуществляется на основании вашего согласия, а также для исполнения договора (Пользовательского соглашения и, для платных услуг, Публичной оферты), стороной которого вы являетесь.',
        ],
      },
      {
        h: '5. Кому мы передаём данные',
        p: [
          'Мы не продаём персональные данные и не передаём их для рекламы. Данные получают только те, кто нужен для работы Платформы:',
        ],
        ul: [
          'хостинг-провайдер сервера Node Host (Германия, Франкфурт-на-Майне) — размещение приложения и базы данных, и облачное хранилище Selectel (Россия) — файлы и видео;',
          'Resend (за пределами РФ) — отправка электронных писем: получает адрес получателя и текст письма;',
          'Google (за пределами РФ) — только если вы входите или регистрируетесь через Google;',
          'OpenAI (за пределами РФ) — функции искусственного интеллекта (подсказки, проверка кода, помощник): получает текст, код и вопросы, которые вы вводите в этих функциях; ваш адрес почты и пароль не передаются;',
          'платёжный сервис — только для платных услуг, название указывается на странице оплаты;',
          'государственные органы — когда это требует закон.',
        ],
      },
      {
        h: '6. Трансграничная передача',
        p: [
          'Размещение сервера и базы данных в Германии, а также передача данных Resend, Google и OpenAI означают передачу в иностранные государства, где защита данных может отличаться от российской. Она осуществляется только в объёме, необходимом для соответствующей функции, и на основании вашего согласия. Вы можете не пользоваться этими функциями (например, войти по паролю вместо Google).',
        ],
      },
      {
        h: '7. Сроки хранения',
        ul: [
          'Данные аккаунта и учебные данные хранятся, пока существует ваш аккаунт.',
          'После удаления аккаунта мы удаляем или обезличиваем данные в течение 30 дней, кроме тех, которые обязаны хранить по закону (например, документы о платежах).',
          'Зашифрованные резервные копии хранятся не более 60 дней, после чего удаляются; удалённый аккаунт исчезает из них вместе с копиями.',
          'События аналитики хранятся не более 365 дней.',
        ],
      },
      {
        h: '8. Ваши права',
        p: [
          'Вы вправе получить сведения о своих данных и об их обработке, потребовать их уточнения, блокирования или удаления, а также отозвать согласие.',
          'Самый быстрый способ — удалить аккаунт в настройках профиля на Платформе. Для остальных запросов напишите на {email}. Мы ответим в течение 10 рабочих дней.',
          'Если вы считаете, что ваши права нарушены, вы можете обратиться в Роскомнадзор или в суд.',
        ],
      },
      {
        h: '9. Cookie и аналитика',
        p: [
          'Мы используем только необходимые cookie и локальное хранилище браузера: для входа в аккаунт, языка интерфейса и выбранных настроек. Рекламных cookie и сторонних трекеров нет.',
          'Статистика посещений собирается собственной системой аналитики на нашем сервере и не передаётся третьим лицам. Отключить cookie можно в настройках браузера, но вход в аккаунт при этом работать не будет.',
        ],
      },
      {
        h: '10. Защита данных',
        p: [
          'Мы применяем технические и организационные меры: шифрование соединения (HTTPS), хранение паролей только в виде хешей, ограничение доступа к серверу, шифрованные резервные копии. Полной безопасности в интернете не гарантирует никто; о существенных инцидентах мы уведомим пострадавших и уполномоченные органы в порядке, установленном законом.',
        ],
      },
      {
        h: '11. Дети',
        p: ['Если вам меньше 14 лет, регистрация возможна только с согласия родителя или иного законного представителя.'],
      },
      {
        h: '12. Изменения Политики',
        p: [
          'Актуальная версия опубликована на этой странице вместе с датой версии. О существенных изменениях мы сообщим на Платформе или по электронной почте.',
        ],
      },
    ],
  },

  terms: {
    title: 'Пользовательское соглашение',
    sections: [
      {
        h: '1. Общие положения',
        p: [
          'Соглашение определяет правила использования образовательной платформы SIRIUS на сайте https://{site} (далее — Платформа). Правообладатель и владелец Платформы — {name}, ИНН {inn}, ОГРНИП {ogrnip}, адрес: {address}, e-mail: {email} (далее — Оператор).',
          'Регистрация на Платформе или её использование означает принятие Соглашения. Если вы не согласны с условиями, не используйте Платформу.',
        ],
      },
      {
        h: '2. Аккаунт',
        ul: [
          'Указывайте достоверные данные. Один человек — один аккаунт.',
          'Вы отвечаете за сохранность пароля и за все действия, совершённые из вашего аккаунта. Не передавайте доступ другим людям.',
          'Если вам меньше 14 лет, нужно согласие родителя или законного представителя; с 14 до 18 лет — их осведомлённость.',
          'Оператор вправе отказать в регистрации или заблокировать аккаунт при нарушении Соглашения.',
        ],
      },
      {
        h: '3. Правила использования',
        p: ['На Платформе запрещено:'],
        ul: [
          'нарушать закон и права других лиц, публиковать оскорбления, спам, запрещённые материалы;',
          'публиковать материалы, права на которые вам не принадлежат;',
          'пытаться получить доступ к чужим аккаунтам и данным, взламывать, перегружать или иным образом нарушать работу Платформы, обходить ограничения;',
          'запускать в проверяющей системе вредоносный код, майнинг, сетевые атаки и попытки выйти за пределы среды выполнения;',
          'автоматически собирать данные Платформы и копировать, перепродавать или распространять материалы курсов;',
          'выдавать себя за другое лицо.',
        ],
      },
      {
        h: '4. Материалы и права',
        p: [
          'Материалы курсов защищены авторским правом и принадлежат их авторам и Оператору. Вам предоставляется личное, неисключительное, непередаваемое право использовать их для обучения на Платформе; копирование и распространение без разрешения запрещены.',
          'Комментарии, ответы, код и другие материалы, которые вы публикуете, остаются вашими. Вы даёте Оператору неисключительное право хранить и показывать их на Платформе в той мере, в какой это нужно для работы сервиса (в том числе другим слушателям курса). Вы отвечаете за то, что у вас есть права на публикуемое.',
        ],
      },
      {
        h: '5. Проверка кода и искусственный интеллект',
        p: [
          'Код выполняется в изолированной среде с ограничениями по времени и памяти. Результаты автоматической проверки и подсказки искусственного интеллекта носят справочный характер, могут содержать ошибки и не заменяют оценку преподавателя.',
          'Не вводите в функции искусственного интеллекта пароли, ключи и иные конфиденциальные сведения: введённый текст передаётся стороннему сервису (см. Политику).',
        ],
      },
      {
        h: '6. Платные услуги',
        p: ['Условия платного доступа, цены и возвраты определены в Публичной оферте.'],
      },
      {
        h: '7. Доступность и изменения',
        p: [
          'Платформа предоставляется «как есть». Возможны технические перерывы, обновления и изменения функций. Оператор стремится сохранять ваши данные, но рекомендует хранить копии важных материалов.',
        ],
      },
      {
        h: '8. Ответственность',
        p: [
          'Оператор отвечает в пределах, установленных законом, и не отвечает за косвенные убытки, за действия третьих лиц, за результаты обучения и за невозможность использования Платформы по причинам, не зависящим от Оператора.',
          'Вы отвечаете за нарушения Соглашения и обязаны возместить причинённый ими ущерб.',
        ],
      },
      {
        h: '9. Прекращение',
        p: [
          'Вы можете удалить аккаунт в любое время в настройках профиля. Оператор вправе ограничить или прекратить доступ при нарушении Соглашения.',
        ],
      },
      {
        h: '10. Прочее',
        p: [
          'Оператор вправе изменять Соглашение; актуальная версия и её дата опубликованы на этой странице. Продолжая пользоваться Платформой после изменений, вы принимаете новую версию.',
          'Применяется право Российской Федерации. Споры стараются решить путём переговоров: претензии направляются на {email}, срок ответа — 30 дней. Если соглашения достичь не удалось, спор рассматривается судом в порядке, установленном законом.',
        ],
      },
    ],
  },

  consent: {
    title: 'Согласие на обработку персональных данных',
    sections: [
      {
        p: [
          'Я, действуя свободно, своей волей и в своём интересе, даю {name}, ИНН {inn}, ОГРНИП {ogrnip}, адрес: {address} (далее — Оператор), согласие на обработку моих персональных данных на условиях, изложенных ниже и в Политике в отношении обработки персональных данных, опубликованной на https://{site}/privacy.',
        ],
      },
      {
        h: 'Перечень данных',
        p: [
          'Адрес электронной почты, имя пользователя, имя и фамилия, хеш пароля, изображение профиля и описание (если указаны), IP-адрес, сведения о браузере и устройстве, сведения о моей активности и результатах обучения (прогресс, ответы, код, оценки, комментарии, сертификаты), данные, полученные от Google при входе через Google.',
        ],
      },
      {
        h: 'Цели',
        p: [
          'Создание и обслуживание аккаунта, предоставление доступа к курсам, учёт прогресса, проверка заданий (в том числе с помощью искусственного интеллекта), отправка служебных сообщений, обеспечение безопасности, статистика и улучшение Платформы, заключение и исполнение договоров, приём платежей.',
        ],
      },
      {
        h: 'Действия и способы',
        p: [
          'Сбор, запись, систематизация, накопление, хранение, уточнение, использование, передача (предоставление, доступ) лицам, перечисленным в Политике, блокирование, удаление, уничтожение. Обработка осуществляется с использованием средств автоматизации.',
        ],
      },
      {
        h: 'Передача за пределы России',
        p: [
          'Я согласен(на) на передачу данных за пределы Российской Федерации в объёме, необходимом для работы соответствующих функций: размещение на сервере в Германии (Node Host), Resend (отправка писем), Google (вход через Google), OpenAI (функции искусственного интеллекта). Я понимаю, что в этих государствах уровень защиты данных может отличаться от российского.',
        ],
      },
      {
        h: 'Срок и отзыв',
        p: [
          'Согласие действует до его отзыва или удаления моего аккаунта. Я могу отозвать согласие, удалив аккаунт в настройках профиля или направив заявление на {email}. После отзыва данные удаляются или обезличиваются в течение 30 дней, кроме данных, которые Оператор обязан хранить по закону. Отзыв согласия делает невозможным использование Платформы.',
        ],
      },
    ],
  },

  offer: {
    title: 'Публичная оферта на оказание платных образовательных услуг',
    sections: [
      {
        h: '1. Общие положения',
        p: [
          '{name}, ИНН {inn}, ОГРНИП {ogrnip}, адрес: {address}, e-mail: {email} (далее — Исполнитель), публикует настоящую оферту — предложение заключить договор об оказании платных услуг по предоставлению доступа к учебным курсам на Платформе SIRIUS (https://{site}).',
          'Акцептом оферты является оплата выбранного курса. С момента оплаты договор считается заключённым.',
        ],
      },
      {
        h: '2. Предмет договора',
        p: [
          'Исполнитель предоставляет заказчику (далее — Слушатель) доступ к выбранному курсу на Платформе на срок, указанный на странице курса (если срок не указан — на весь срок существования курса на Платформе). Состав материалов и описание курса приведены на его странице.',
        ],
      },
      {
        h: '3. Цена и оплата',
        p: [
          'Цена указана на странице курса в рублях и включает все налоги, если иное не указано. Оплата производится через платёжный сервис, название которого показывается на странице оплаты. Данные карты вводятся на стороне платёжного сервиса и Исполнителю не передаются.',
          'Доступ открывается сразу после подтверждения оплаты платёжным сервисом. Чек направляется на указанный при оплате адрес электронной почты.',
        ],
      },
      {
        h: '4. Отказ от услуги и возврат',
        ul: [
          'Слушатель вправе отказаться от услуги в любое время, оплатив фактически понесённые Исполнителем расходы.',
          'Если после оплаты прошло не более 14 дней и Слушатель открыл не более 20% материалов курса, Исполнитель возвращает полную стоимость.',
          'В остальных случаях возвращается стоимость за вычетом части курса, которая была использована.',
          'Для возврата напишите на {email} с адреса, указанного при регистрации. Возврат производится тем же способом, которым была оплата, в течение 10 рабочих дней с момента получения заявления.',
        ],
      },
      {
        h: '5. Права и обязанности',
        ul: [
          'Исполнитель обеспечивает доступ к курсу и стремится поддерживать работу Платформы без перерывов; технические перерывы не считаются нарушением.',
          'Слушатель использует доступ лично, не передаёт его третьим лицам и соблюдает Пользовательское соглашение. Исполнитель вправе прекратить доступ при нарушении, без возврата платы за период нарушения.',
          'Результат обучения зависит от усилий Слушателя; Исполнитель не гарантирует трудоустройство или достижение конкретного результата.',
        ],
      },
      {
        h: '6. Персональные данные',
        p: ['Обработка персональных данных осуществляется в соответствии с Политикой, опубликованной на https://{site}/privacy.'],
      },
      {
        h: '7. Прочее',
        p: [
          'Применяется право Российской Федерации. Претензии направляются на {email}, срок ответа — 30 дней; спор рассматривается судом в порядке, установленном законом. Права потребителей, установленные законом, не ограничиваются настоящей офертой.',
        ],
      },
    ],
  },

  contacts: {
    title: 'Контакты и сведения об операторе',
    sections: [
      {
        p: [
          'Владелец сайта и оператор персональных данных: {name}.',
          'ИНН: {inn}. ОГРНИП: {ogrnip}.',
          'Адрес: {address}.',
          'E-mail для обращений, вопросов по персональным данным и возвратов: {email}.',
          'Сайт: https://{site}',
        ],
      },
      {
        h: 'Документы',
        p: [
          'Политика в отношении обработки персональных данных — /privacy',
          'Пользовательское соглашение — /terms',
          'Согласие на обработку персональных данных — /consent',
          'Публичная оферта — /offer',
        ],
      },
    ],
  },
}

const en: Record<DocKey, LegalDoc> = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      {
        h: '1. General',
        p: [
          'The operator of personal data is {name}, tax ID (INN) {inn}, registration no. (OGRNIP) {ogrnip}, address: {address}, e-mail: {email} (the "Operator").',
          'This Policy applies to https://{site} and the SIRIUS learning platform (the "Platform"). It follows the Russian Federal Law No. 152-FZ "On Personal Data". The Russian text is binding; this is a translation.',
          'By using the Platform you confirm you have read this Policy. Consent to processing is given separately when you register.',
        ],
      },
      {
        h: '2. Data we process',
        ul: [
          'Account data: e-mail address, username, first and last name (if given), password stored only as an irreversible hash, avatar and profile description (optional).',
          'Learning data: course progress, answers to assignments and quizzes, submitted code and its check results, grades, certificates, comments and messages.',
          'Technical data: IP address, sign-in time, browser and device information, pages viewed and actions on the Platform (our own analytics events).',
          'When you sign in with Google: your e-mail address, name and Google account identifier, which Google passes on with your permission.',
          'Payment data: we do not receive or store bank card details; payment is handled by the payment service. We only learn whether a payment was made and its amount.',
        ],
      },
      {
        h: '3. Purposes',
        ul: [
          'creating and maintaining your account and identifying you;',
          'giving access to courses, tracking progress, issuing certificates;',
          'checking assignments, including automatic code checks and hints from AI services;',
          'sending service messages (password reset, sign-in link, course notifications);',
          'security and abuse prevention;',
          'usage statistics and improving the Platform;',
          'concluding and performing contracts, accepting payments and refunds.',
        ],
      },
      {
        h: '4. Legal grounds',
        p: ['We process data on the basis of your consent and to perform a contract with you (the Terms of Use and, for paid services, the Public Offer).'],
      },
      {
        h: '5. Who receives your data',
        p: ['We do not sell personal data and do not share it for advertising. Only those needed to run the Platform receive data:'],
        ul: [
          'the server hosting provider Node Host (Germany, Frankfurt am Main): the application and the database, and Selectel cloud storage (Russia): files and videos;',
          'Resend (outside Russia): sending e-mail; receives the recipient address and the message text;',
          'Google (outside Russia): only if you sign in or register with Google;',
          'OpenAI (outside Russia): AI features (hints, code review, assistant); receives the text, code and questions you enter into these features; your e-mail and password are not sent;',
          'a payment service: only for paid services, named on the payment page;',
          'public authorities when the law requires it.',
        ],
      },
      {
        h: '6. Transfer outside Russia',
        p: [
          'Hosting the server and database in Germany, and sending data to Resend, Google and OpenAI, is a transfer to foreign countries where data protection may differ from Russian law. It is limited to what each feature needs and is based on your consent. You can avoid these features (for example, sign in with a password instead of Google).',
        ],
      },
      {
        h: '7. Retention',
        ul: [
          'Account and learning data are kept while your account exists.',
          'After you delete your account we delete or anonymise the data within 30 days, except what the law requires us to keep (for example payment records).',
          'Encrypted backups are kept for no more than 60 days and then deleted.',
          'Analytics events are kept for no more than 365 days.',
        ],
      },
      {
        h: '8. Your rights',
        p: [
          'You may obtain information about your data and how it is processed, ask for it to be corrected, blocked or deleted, and withdraw your consent.',
          'The quickest way is to delete your account in your profile settings. For other requests write to {email}; we reply within 10 working days.',
          'If you believe your rights are violated you may complain to Roskomnadzor or go to court.',
        ],
      },
      {
        h: '9. Cookies and analytics',
        p: [
          'We only use cookies and browser storage that are necessary: to keep you signed in, remember the interface language and your settings. There are no advertising cookies or third-party trackers.',
          'Visit statistics are collected by our own analytics on our own server and are not shared. You can disable cookies in your browser, but then signing in will not work.',
        ],
      },
      {
        h: '10. Security',
        p: [
          'We use technical and organisational measures: encrypted connections (HTTPS), passwords stored only as hashes, restricted server access and encrypted backups. No system is perfectly secure; in case of a significant incident we will notify those affected and the authorities as the law requires.',
        ],
      },
      {
        h: '11. Children',
        p: ['If you are under 14, you may register only with the consent of a parent or legal guardian.'],
      },
      {
        h: '12. Changes',
        p: ['The current version is published on this page with its version date. We will announce significant changes on the Platform or by e-mail.'],
      },
    ],
  },

  terms: {
    title: 'Terms of Use',
    sections: [
      {
        h: '1. General',
        p: [
          'These Terms govern the use of the SIRIUS learning platform at https://{site} (the "Platform"). The Platform is owned by {name}, INN {inn}, OGRNIP {ogrnip}, address: {address}, e-mail: {email} (the "Operator"). The Russian text is binding; this is a translation.',
          'Registering or using the Platform means you accept the Terms. If you do not agree, do not use the Platform.',
        ],
      },
      {
        h: '2. Account',
        ul: [
          'Give accurate information. One person, one account.',
          'You are responsible for keeping your password safe and for everything done from your account. Do not share access.',
          'If you are under 14 you need the consent of a parent or guardian; between 14 and 18 they should be aware of your use.',
          'The Operator may refuse registration or block an account that breaks the Terms.',
        ],
      },
      {
        h: '3. Rules',
        p: ['You must not:'],
        ul: [
          'break the law or the rights of others, or publish insults, spam or prohibited material;',
          'publish material you do not have the rights to;',
          "try to access other people's accounts or data, hack, overload or disrupt the Platform, or bypass its limits;",
          'run malicious code, mining, network attacks or attempts to escape the sandbox in the code-checking system;',
          'scrape the Platform or copy, resell or distribute course materials;',
          'impersonate someone else.',
        ],
      },
      {
        h: '4. Content and rights',
        p: [
          'Course materials are protected by copyright and belong to their authors and the Operator. You get a personal, non-exclusive, non-transferable right to use them for learning on the Platform; copying and distribution without permission are forbidden.',
          'Comments, answers, code and other material you publish remain yours. You give the Operator a non-exclusive right to store and display them on the Platform as needed to run the service (including to other learners in the course). You are responsible for having the rights to what you publish.',
        ],
      },
      {
        h: '5. Code checking and AI',
        p: [
          'Code runs in an isolated environment with time and memory limits. Automatic check results and AI hints are for guidance only, may contain mistakes and do not replace a teacher\'s assessment.',
          'Do not enter passwords, keys or other confidential information into AI features: the text is sent to a third-party service (see the Privacy Policy).',
        ],
      },
      { h: '6. Paid services', p: ['Terms of paid access, prices and refunds are in the Public Offer.'] },
      {
        h: '7. Availability and changes',
        p: [
          'The Platform is provided "as is". There may be outages, updates and changes to features. The Operator works to keep your data safe but recommends keeping copies of important material.',
        ],
      },
      {
        h: '8. Liability',
        p: [
          'The Operator is liable to the extent set by law and is not liable for indirect losses, for third parties, for learning results, or for inability to use the Platform for reasons beyond its control.',
          'You are liable for breaches of the Terms and must compensate the damage they cause.',
        ],
      },
      {
        h: '9. Termination',
        p: ['You can delete your account at any time in your profile settings. The Operator may restrict or end access if the Terms are broken.'],
      },
      {
        h: '10. Other',
        p: [
          'The Operator may change the Terms; the current version and its date are published on this page. Continuing to use the Platform after a change means you accept the new version.',
          'Russian law applies. We try to settle disputes by negotiation: send claims to {email}; we reply within 30 days. If no agreement is reached, the dispute is decided by a court as the law provides.',
        ],
      },
    ],
  },

  consent: {
    title: 'Consent to personal data processing',
    sections: [
      {
        p: [
          'I, acting freely, of my own will and in my own interest, give {name}, INN {inn}, OGRNIP {ogrnip}, address: {address} (the "Operator"), my consent to the processing of my personal data on the terms below and in the Privacy Policy published at https://{site}/privacy.',
        ],
      },
      {
        h: 'Data',
        p: [
          'E-mail address, username, first and last name, password hash, profile picture and description (if given), IP address, browser and device information, information about my activity and learning results (progress, answers, code, grades, comments, certificates), and data received from Google when I sign in with Google.',
        ],
      },
      {
        h: 'Purposes',
        p: [
          'Creating and maintaining my account, giving access to courses, tracking progress, checking assignments (including with AI), sending service messages, security, statistics and improving the Platform, concluding and performing contracts, accepting payments.',
        ],
      },
      {
        h: 'Actions and means',
        p: [
          'Collection, recording, organising, accumulation, storage, updating, use, transfer (provision, access) to the parties listed in the Policy, blocking, deletion and destruction, using automated means.',
        ],
      },
      {
        h: 'Transfer outside Russia',
        p: [
          'I agree to the transfer of data outside the Russian Federation to the extent needed for the relevant features: hosting on a server in Germany (Node Host), Resend (sending e-mail), Google (Google sign-in), OpenAI (AI features). I understand that data protection in those countries may differ from Russian law.',
        ],
      },
      {
        h: 'Duration and withdrawal',
        p: [
          'This consent lasts until I withdraw it or delete my account. I can withdraw it by deleting my account in profile settings or by writing to {email}. After withdrawal the data is deleted or anonymised within 30 days, except what the Operator must keep by law. Withdrawing consent makes it impossible to use the Platform.',
        ],
      },
    ],
  },

  offer: {
    title: 'Public Offer for paid educational services',
    sections: [
      {
        h: '1. General',
        p: [
          '{name}, INN {inn}, OGRNIP {ogrnip}, address: {address}, e-mail: {email} (the "Provider") publishes this offer: a proposal to conclude a contract for paid access to courses on the SIRIUS Platform (https://{site}). The Russian text is binding; this is a translation.',
          'Paying for a course is acceptance of the offer; the contract is concluded at payment.',
        ],
      },
      {
        h: '2. Subject',
        p: [
          'The Provider gives the customer (the "Learner") access to the chosen course on the Platform for the period shown on the course page (if none is shown, for as long as the course exists on the Platform). The course description and contents are on its page.',
        ],
      },
      {
        h: '3. Price and payment',
        p: [
          'The price is shown on the course page in roubles and includes all taxes unless stated otherwise. Payment is made through a payment service named on the payment page. Card details are entered on the payment service side and are not passed to the Provider.',
          'Access opens as soon as the payment service confirms payment. A receipt is sent to the e-mail address given at payment.',
        ],
      },
      {
        h: '4. Cancellation and refunds',
        ul: [
          'The Learner may cancel at any time by paying the Provider\'s actual costs.',
          'If no more than 14 days have passed since payment and the Learner has opened no more than 20% of the course, the Provider refunds the full price.',
          'Otherwise the price is refunded minus the part of the course already used.',
          'To get a refund write to {email} from the address used at registration. The refund is made the same way as the payment within 10 working days of the request.',
        ],
      },
      {
        h: '5. Rights and duties',
        ul: [
          'The Provider gives access to the course and works to keep the Platform running; technical outages are not a breach.',
          'The Learner uses the access personally, does not pass it to others and follows the Terms of Use. The Provider may end access on breach, without refunding the period of breach.',
          'Results depend on the Learner\'s effort; the Provider does not guarantee employment or any specific result.',
        ],
      },
      { h: '6. Personal data', p: ['Personal data is processed under the Policy published at https://{site}/privacy.'] },
      {
        h: '7. Other',
        p: [
          'Russian law applies. Send claims to {email}; we reply within 30 days; a dispute is decided by a court as the law provides. Consumer rights set by law are not limited by this offer.',
        ],
      },
    ],
  },

  contacts: {
    title: 'Contacts and operator details',
    sections: [
      {
        p: [
          'Site owner and operator of personal data: {name}.',
          'INN: {inn}. OGRNIP: {ogrnip}.',
          'Address: {address}.',
          'E-mail for requests, personal data questions and refunds: {email}.',
          'Site: https://{site}',
        ],
      },
      {
        h: 'Documents',
        p: [
          'Privacy Policy — /privacy',
          'Terms of Use — /terms',
          'Consent to personal data processing — /consent',
          'Public Offer — /offer',
        ],
      },
    ],
  },
}

export const LEGAL_DOCS: Record<DocKey, Record<Lang, LegalDoc>> = {
  privacy: { ru: ru.privacy, en: en.privacy },
  terms: { ru: ru.terms, en: en.terms },
  consent: { ru: ru.consent, en: en.consent },
  offer: { ru: ru.offer, en: en.offer },
  contacts: { ru: ru.contacts, en: en.contacts },
}
