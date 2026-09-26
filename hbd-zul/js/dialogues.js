// Dialogues & Comedy Scripts
// Primary: Russian (dramatic, humorous, grumpy & sarcastic friend vibes)
// Secondary: English subtitles / tooltips
// Cultural Accent: Mongolian greetings & elements
// Tone: 100% Platonic Friendship! Zulya is naturally grumpy/pouting (бука/обидчивая)

const GAME_DIALOGUES = {
    intro: {
        speaker: "Зуля (из юрты)",
        speakerMn: "Зуля (Гэр дотроос)",
        speakerEn: "Zulya (From inside the yurt)",
        textRu: "КТО ТАМ ОПЯТЬ ШУМИТ?! Мой день рождения был 26 ИЮНЯ! Я уже три месяца на законных основаниях дуюсь! КТО ЭТО?!",
        textEn: "WHO'S MAKING NOISE AGAIN?! My birthday was JUNE 26th! I've been rightfully pouting for 3 months! WHO IS IT?!",
        mood: "furious",
        options: [
            {
                id: "excuse_forgot",
                textRu: "Эээ... ну я просто замотался и забыл... с кем не бывает?",
                textEn: "Uhh... I got busy and forgot... doesn't it happen to everyone?",
                type: "fail",
                responseRu: "С КЕМ НЕ БЫВАЕТ?! ТЫ СЕРЬЁЗНО?! НА ТАПКОМ В ЛОБ, БАЛБЕС!",
                responseEn: "HAPPENS TO EVERYONE?! ARE YOU SERIOUS?! CATCH A SLIPPER TO THE HEAD, SILLY!",
                rageDelta: +20,
                addLock: true,
                throwItem: "tapok"
            },
            {
                id: "excuse_early",
                textRu: "Я НЕ опоздал! Я просто поздравляю ПЕРВЫМ с ДР на следующий год (2027) за 9 месяцев!",
                textEn: "I'm NOT late! I'm simply the FIRST in the world wishing you for NEXT year (2027) 9 months early!",
                type: "success",
                responseRu: "Что?! На следующий год?! Какая дикая наглость... Но логика железная, не придерёшься...",
                responseEn: "What?! For next year?! What audacious boldness... But iron logic, can't argue...",
                rageDelta: -25,
                unlockDoor: true
            },
            {
                id: "excuse_gobi",
                textRu: "Мы везли открытку на верблюде через Гоби, и верблюд ушёл в отпуск!",
                textEn: "We carried the greeting by camel through the Gobi desert, and the camel took a vacation!",
                type: "success",
                responseRu: "Бедный верблюд... Ты животное хоть напоил?! Ладно, верблюда мне жалко больше, чем тебя.",
                responseEn: "Poor camel... Did you at least give him water?! Alright, I pity the camel more than you.",
                rageDelta: -30,
                unlockDoor: true
            },
            {
                id: "excuse_physics",
                textRu: "По теории относительности Эйнштейна возле черной дыры прошло всего 3 секунды!",
                textEn: "According to Einstein's relativity near a black hole, only 3 seconds have passed!",
                type: "success",
                responseRu: "Ты ещё и физику приплёл?! Каков наглец... Ворчать хочется, но рассмешил!",
                responseEn: "You even dragged physics into this?! The audacity... I want to grumble, but made me chuckle!",
                rageDelta: -20,
                unlockDoor: true
            }
        ]
    },

    stage_bribe: {
        speaker: "Зуля (из юрты)",
        speakerMn: "Зуля (Гэр дотроос)",
        speakerEn: "Zulya (From inside the yurt)",
        textRu: "Ладно, допустим! Но дверь на замке! Что ты притащил?! Показывай, чем собираешься задабривать моё законное недовольство!",
        textEn: "Alright, suppose so! But the door is locked! What did you bring?! Show me how you plan to appease my righteous grumpiness!",
        mood: "suspicious",
        hintRu: "👉 Нажми на подношения внизу (Торт, Чай, Цветы), чтобы задобрить Зулю!",
        hintEn: "👉 Tap on the peace offerings below (Cake, Tea, Flowers) to appease Zulya!"
    },

    items: {
        cake: {
            nameRu: "Торт 90-дневной выдержки 🎂",
            nameMn: "90 хоног дарсан бялуу 🎂",
            nameEn: "90-Day Aged Cake 🎂",
            descRu: "Антикварный торт с 26 июня. Твёрдый как гранит, но от верного друга!",
            descEn: "Vintage antique cake from June 26th. Hard as granite, but from a true friend!",
            reactionRu: "ТОРТ С ИЮНЯ?! Им же можно в степи волков отпугивать, он каменный! ...Хотя клубничка сверху вроде ещё ничего. Ладно, оставь у входа, зачтено.",
            reactionEn: "A CAKE FROM JUNE?! You could scare wolves in the steppe with it, it's stone! ...Though the strawberry is intact. Alright, leave it by the door.",
            rageDelta: -25,
            unlockDoor: true
        },
        tea: {
            nameRu: "Горячий Сүүтэй цай ☕",
            nameMn: "Халуун сүүтэй цай ☕",
            nameEn: "Hot Suutei Tsai (Milk Tea) ☕",
            descRu: "Традиционный монгольский чай с молоком и солью, сварен чтобы остудить пыл.",
            descEn: "Traditional Mongolian milk tea with salt, brewed to cool down hot tempers.",
            reactionRu: "Хмм... настоящий горячий Сүүтэй цай. Ладно, чашку возьму — чай я люблю. Но имей в виду: я всё равно на тебя сержусь!",
            reactionEn: "Hmm... real hot Suutei Tsai. Alright, I'll take the cup — I do love tea. But keep in mind: I'm still grumpy at you!",
            rageDelta: -30,
            unlockDoor: true
        },
        flowers: {
            nameRu: "Степные цветы 💐",
            nameMn: "Тал нутгийн цэцэгс 💐",
            nameEn: "Steppe Wildflowers 💐",
            descRu: "Свежие цветы, сорванные посреди бескрайней монгольской степи.",
            descEn: "Fresh wildflowers picked in the vast Mongolian steppe.",
            reactionRu: "Степные цветы? Думаешь, нарвал бурьяна в степи и я сразу растаю?! ...Ладно, пахнут приятно. Минус один замок, но не зазнавайся.",
            reactionEn: "Steppe flowers? Think you can pick some weeds and I'll instantly melt?! ...Fine, they smell nice. Minus one lock, but don't get smug.",
            rageDelta: -20,
            unlockDoor: true
        }
    },

    stage_final_question: {
        speaker: "Зуля (приоткрывая окошко)",
        speakerMn: "Зуля (Цонхоо бага зэрэг нээж)",
        speakerEn: "Zulya (Peeking through window)",
        textRu: "Остался последний замок. Ответь прямо: почему я вообще должна открывать эту дверь человеку, который забыл про 26 июня?!",
        textEn: "Only the final lock remains. Answer straight: why should I even open this door to someone who forgot June 26th?!",
        mood: "suspicious",
        options: [
            {
                id: "final_lazy",
                textRu: "Да просто открой, а то на улице в степи стоять холодно!",
                textEn: "Just open up already, it's getting chilly standing outside in the steppe!",
                type: "fail",
                responseRu: "ХОЛОДНО ЕМУ?! А Я 3 МЕСЯЦА ДУЛАСЬ! НА ЕЩЁ САПОГОМ В ДОГОНКУ!",
                responseEn: "CHILLY FOR YOU?! I'VE BEEN POUTING FOR 3 MONTHS! TAKE ANOTHER BOOT!",
                rageDelta: +15,
                addLock: true,
                throwItem: "gutal"
            },
            {
                id: "final_heartfelt",
                textRu: "Потому что я — твой лучший друг всех времён! А ты хоть и главная бука, но самый крутой человек! Төрсөн өдрийн мэнд, Зуля!",
                textEn: "Because I am your all-time best friend! And even though you're a grumpy queen, you're the coolest person! Törsön ödriin mend, Zulya!",
                type: "victory",
                responseRu: "Ой, ладно-ладно, хватит драмы! Заходи уже, пока чай не остыл. Но посуду моешь ты! Төрсөн өдрийн мэнд мне! 😒➔😏",
                responseEn: "Oh, alright-alright, enough drama! Get in before the tea cools down. But you're washing the dishes! Happy birthday to me! 😒➔😏",
                rageDelta: -100,
                unlockDoor: true
            }
        ]
    },

    final_card: {
        titleMn: "Төрсөн өдрийн мэнд хүргэе, Зуля! 🎂",
        titleRu: "С Днём Рождения, Зуля! 🎉",
        titleEn: "Belated Happy Birthday, Zulya! 🌟",
        subtitleRu: "Официальный сертификат признания вины перед самой ворчливой, но самой крутой подругой",
        subtitleEn: "Official Certificate of Atonement before the moodiest, yet coolest friend",
        bodyMn: "Хэдийгээр 3 сар хоцорсон ч гэсэн, жинхэнэ нөхөрлөл хэзээ ч хуучрахгүй!",
        bodyRu: `Дорогая Зуля! 
Да, 26 июня уже давно позади. Этот торт пережил смену времён года, верблюд в пустыне Гоби взял отпуск, а тапки летели со скоростью звука.

Ты имеешь полное законное право дуться на меня ещё три года! Но настоящая дружба крепче любых обид и монгольских ветров. Пусть в твоей жизни будет меньше поводов ворчать и больше поводов для классных приключений.

Желаю железного терпения (особенно на таких забывчивых друзей), неиссякаемой энергии, крутых успехов и верных друзей рядом!`,
        bodyEn: `Even though 90+ days have passed since June 26th, true solid friendship never expires. Keep being the coolest (and moodiest) friend ever!`,
        senderLabelMn: "Хамгийн их гэмшсэн, гэхдээ үнэнч найз:",
        senderTitleMn: "БҮХ ЦАГ ҮЕИЙН ХАМГИЙН ШИЛДЭГ НАЙЗ",
        senderTitleRu: "Твой самый виноватый, но лучший друг всех времён и народов 🤝"
    }
};

window.GAME_DIALOGUES = GAME_DIALOGUES;
