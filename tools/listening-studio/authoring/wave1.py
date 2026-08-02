"""Author Wave 1: real speakers, register-appropriate delivery, and questions that need the ear.

The drafted scripts were good German and are kept almost verbatim. The questions were not: they
were template residue from the removed `listening` item type. Several asked about things the
recording never says (a Datei in a script about counting cartons; coffee in a script about a
train), several had `['A', 'B']` as the options, and several marked a false statement correct.
No gate can see any of that — instruction, options, key and audio can all disagree while every
schema check passes.

Two questions per artifact, not three. Each one targets what only the ear delivers — a digit, a
time, a platform, an order of steps — and every distractor is a mistake a learner at that level
actually makes: an adjacent digit, the time that was cancelled, the step that comes second.
"""

from listening_studio.domain import Bilingual, Line, Question, RevisionPayload, SingleChoice
from listening_studio.storage import Store

# Delivery per scene. The nine timbres are fixed and none is a German native, so register is
# carried by `instruct` — a station announcement and two friends making plans must not arrive in
# the same voice-over reading tone.
ANNOUNCE = "Sprich sachlich, deutlich und etwas langsamer, wie eine Bahnhofsdurchsage."
OFFICIAL = "Sprich freundlich, ruhig und sachlich, wie am Empfang einer Behörde."
CASUAL = "Sprich locker und freundlich, wie im Gespräch mit einer guten Freundin."
MESSAGE = "Sprich natürlich und etwas schneller, wie in einer Sprachnachricht an eine Freundin."
TEACHER = "Sprich klar und geduldig, wie eine Lehrerin, die eine Aufgabe erklärt."
ASKING = "Sprich höflich und etwas zögernd, wie jemand, der um Hilfe bittet."
CALM = "Sprich ruhig, interessiert und aufmerksam, wie in einem Interview."

WAVE1: dict[str, dict] = {
    # ---------------------------------------------------------------- A1 ----
    "ls-erste-schritte-01": {
        "speakers": ["Mitarbeiterin", "Herr Osei"],
        "pace": 0.90,
        "title": ("Bürgerbüro: the telephone number", "Бюро: номер телефона"),
        "lines": [
            ("Mitarbeiterin", "Sohee", OFFICIAL, "Guten Tag. Hier ist das Bürgerbüro. Wie kann ich Ihnen helfen?"),
            ("Herr Osei", "Dylan", ASKING, "Guten Tag. Ich brauche einen Termin. Unter welcher Nummer kann ich Sie morgen anrufen?"),
            ("Mitarbeiterin", "Sohee", OFFICIAL, "Unsere Telefonnummer ist null drei null, acht vier zwei, sechs eins neun."),
            ("Herr Osei", "Dylan", ASKING, "Also: null drei null, acht vier zwei, sechs eins neun?"),
            ("Mitarbeiterin", "Sohee", OFFICIAL, "Ja, genau. Wir sind ab neun Uhr erreichbar."),
        ],
        "questions": [
            (
                "Wie ist die Telefonnummer vom Bürgerbüro?",
                ["030 842 619", "030 824 619", "030 842 691"],
                0,
                "The number is said twice — once by the office, once repeated back to confirm it. The two wrong options swap a neighbouring pair of digits, which is exactly what goes wrong when you write a number down while listening.",
                "Номер звучит дважды: сотрудница называет его, а посетитель повторяет для подтверждения. В неверных вариантах переставлены соседние цифры — именно так ошибаются, записывая номер на слух.",
            ),
            (
                "Ab wann ist das Bürgerbüro erreichbar?",
                ["Ab neun Uhr.", "Ab acht Uhr.", "Ab zehn Uhr."],
                0,
                "The opening time comes last, after the number is confirmed — the point where attention usually drops. *ab* means 'from … onwards'.",
                "Время работы названо в самом конце, уже после подтверждения номера, — там, где внимание обычно ослабевает. *ab* значит «начиная с».",
            ),
        ],
    },
    "ls-menschen-familie-01": {
        "speakers": ["Mila"],
        "pace": 0.92,
        "title": ("A voice message about the family", "Голосовое сообщение о семье"),
        "lines": [
            ("Mila", "Ono_Anna", MESSAGE, "Hallo Lea, hier ist Mila. Ich bin heute bei meiner Familie."),
            ("Mila", "Ono_Anna", MESSAGE, "Neben mir sitzt mein Bruder Jonas. Er ist achtzehn und studiert in Köln."),
            ("Mila", "Ono_Anna", MESSAGE, "Meine Schwester Anna arbeitet heute. Am Abend kommen auch meine Eltern."),
            ("Mila", "Ono_Anna", MESSAGE, "Dann essen wir alle zusammen. Bis morgen!"),
        ],
        "questions": [
            (
                "Wer studiert in Köln?",
                ["Ihr Bruder Jonas.", "Ihre Schwester Anna.", "Ihre Mutter."],
                0,
                "Two siblings are named in the same breath and only one of them studies — Anna is at work. Catching *which* person a statement belongs to is the whole skill here.",
                "Названы двое: брат и сестра, но учится только один — Анна на работе. Умение расслышать, к кому относится высказывание, здесь и есть навык.",
            ),
            (
                "Was passiert am Abend?",
                ["Die Eltern kommen, und alle essen zusammen.", "Anna kommt von der Arbeit und geht schlafen.", "Mila fährt nach Köln."],
                0,
                "*Am Abend* marks the one future event in the message. The third option recycles *Köln*, which was said — but about Jonas's studies, not about a journey.",
                "*Am Abend* отмечает единственное будущее событие в сообщении. В третьем варианте повторяется «Кёльн» — слово действительно прозвучало, но про учёбу Йонаса, а не про поездку.",
            ),
        ],
    },
    "ls-alltag-zeit-01": {
        "speakers": ["Sara"],
        "pace": 0.90,
        "title": ("An answerphone message with times", "Сообщение на автоответчике со временем"),
        "lines": [
            ("Sara", "Serena", MESSAGE, "Hallo Tom, hier ist Sara. Unser Plan für morgen hat sich geändert."),
            ("Sara", "Serena", MESSAGE, "Wir treffen uns nicht um acht Uhr, sondern um halb neun am Bahnhof."),
            ("Sara", "Serena", MESSAGE, "Zuerst kaufen wir die Fahrkarten. Um neun Uhr fährt der Zug."),
            ("Sara", "Serena", MESSAGE, "Bitte ruf mich heute Abend noch einmal an. Bis dann!"),
        ],
        "questions": [
            (
                "Wann treffen sich Sara und Tom?",
                ["Um halb neun.", "Um acht Uhr.", "Um neun Uhr."],
                0,
                "All three times are spoken. *nicht … sondern* cancels eight o'clock and replaces it; nine o'clock is when the train leaves, not when they meet. A changed appointment is the commonest thing to mishear.",
                "Все три времени звучат в записи. Конструкция *nicht … sondern* отменяет восемь часов и заменяет их; девять — это отправление поезда, а не встреча. Изменённая договорённость — самое частое место ошибки.",
            ),
            (
                "Was machen sie zuerst?",
                ["Sie kaufen die Fahrkarten.", "Sie fahren mit dem Zug.", "Sie rufen am Abend an."],
                0,
                "*Zuerst* orders the two things that happen at the station. The call is for this evening, before any of it.",
                "*Zuerst* задаёт порядок двух действий на вокзале. Звонок — на сегодняшний вечер, то есть до всего остального.",
            ),
        ],
    },
    "ls-stadt-wege-01": {
        "speakers": ["Tourist", "Passantin"],
        "pace": 0.92,
        "title": ("Asking the way to the station", "Спрашиваем дорогу к вокзалу"),
        "lines": [
            ("Tourist", "Aiden", ASKING, "Entschuldigung, wie komme ich zum Bahnhof?"),
            ("Passantin", "Vivian", CASUAL, "Gehen Sie diese Straße geradeaus bis zur Ampel. Dort gehen Sie links."),
            ("Tourist", "Aiden", ASKING, "Und dann?"),
            ("Passantin", "Vivian", CASUAL, "Nach der Apotheke gehen Sie rechts. Der Bahnhof ist gegenüber dem großen Hotel."),
            ("Tourist", "Aiden", ASKING, "Vielen Dank!"),
        ],
        "questions": [
            (
                "Was macht man an der Ampel?",
                ["Links gehen.", "Rechts gehen.", "Geradeaus gehen."],
                0,
                "Three directions are given in sequence and each belongs to a different landmark: straight on *to* the lights, left *at* them, right *after* the pharmacy. Wrong answers here are almost always the right direction attached to the wrong landmark.",
                "Три направления идут подряд, и каждое привязано к своему ориентиру: прямо — *до* светофора, налево — *у* него, направо — *после* аптеки. Ошибка здесь почти всегда в том, что верное направление привязывают не к тому ориентиру.",
            ),
            (
                "Wo ist der Bahnhof?",
                ["Gegenüber dem großen Hotel.", "Neben der Apotheke.", "An der Ampel."],
                0,
                "The pharmacy and the lights are turning points on the way, not the destination. *gegenüber* means 'opposite'.",
                "Аптека и светофор — это повороты по дороге, а не цель. *gegenüber* значит «напротив».",
            ),
        ],
    },
    "ls-freizeit-koennen-01": {
        "speakers": ["Ben", "Nina"],
        "pace": 0.95,
        "title": ("Making plans for the afternoon", "Договариваемся о встрече днём"),
        "lines": [
            ("Ben", "Eric", CASUAL, "Hast du heute Zeit? Wir können schwimmen gehen."),
            ("Nina", "Vivian", CASUAL, "Heute kann ich nicht schwimmen. Mein Arm tut weh. Aber wir können uns im Park treffen."),
            ("Ben", "Eric", CASUAL, "Gute Idee. Kannst du um fünf Uhr kommen?"),
            ("Nina", "Vivian", CASUAL, "Ja. Wir treffen uns um fünf Uhr am Eingang."),
        ],
        "questions": [
            (
                "Warum kann Nina heute nicht schwimmen?",
                ["Ihr Arm tut weh.", "Sie hat keine Zeit.", "Das Schwimmbad ist zu."],
                0,
                "The reason follows immediately after *Ich kann nicht*. The second option is the excuse a learner expects to hear — and Nina says the opposite, since she does have time for the park.",
                "Причина названа сразу после *Ich kann nicht*. Второй вариант — та отговорка, которую ожидаешь услышать, но Нина говорит обратное: на парк время у неё есть.",
            ),
            (
                "Wo treffen sich Ben und Nina?",
                ["Am Eingang vom Park.", "Im Schwimmbad.", "Zu Hause."],
                0,
                "The swimming pool is the plan that was rejected. The place is only settled in the last line, after the time.",
                "Бассейн — это отвергнутый план. Место окончательно названо только в последней реплике, уже после времени.",
            ),
        ],
    },
    # ---------------------------------------------------------------- A2 ----
    "ls-termine-vereinbaren-01": {
        "speakers": ["Praxis", "Frau Kaya"],
        "pace": 0.95,
        "title": ("Arranging an appointment by phone", "Записываемся на приём по телефону"),
        "lines": [
            ("Praxis", "Serena", OFFICIAL, "Praxis Doktor Klein, guten Tag."),
            ("Frau Kaya", "Ryan", ASKING, "Guten Tag. Ich möchte einen Termin vereinbaren."),
            ("Praxis", "Serena", OFFICIAL, "Am Dienstag um zehn Uhr wäre etwas frei."),
            ("Frau Kaya", "Ryan", ASKING, "Da muss ich arbeiten. Geht es am Mittwoch am Nachmittag?"),
            ("Praxis", "Serena", OFFICIAL, "Ja, um vierzehn Uhr dreißig."),
            ("Frau Kaya", "Ryan", ASKING, "Das passt. Dann komme ich am Mittwoch um halb drei. Vielen Dank."),
        ],
        "questions": [
            (
                "Wann kommt Frau Kaya in die Praxis?",
                ["Am Mittwoch um halb drei.", "Am Dienstag um zehn Uhr.", "Am Mittwoch um zehn Uhr."],
                0,
                "The agreed time is said twice in two different formats — *vierzehn Uhr dreißig* by the practice, *halb drei* by the caller. Both are the same time, and hearing them as one appointment rather than two is the point.",
                "Согласованное время звучит дважды в двух форматах: *vierzehn Uhr dreißig* от регистратуры и *halb drei* от пациентки. Это одно и то же время — услышать их как одну запись, а не как две, и есть задача.",
            ),
            (
                "Warum passt der erste Termin nicht?",
                ["Frau Kaya muss am Dienstag arbeiten.", "Die Praxis ist am Dienstag geschlossen.", "Frau Kaya ist am Dienstag krank."],
                0,
                "*Da muss ich arbeiten* is the refusal, and *da* points back to Tuesday ten o'clock. The other two are reasons that would fit the situation but are never given.",
                "*Da muss ich arbeiten* — это отказ, и *da* отсылает ко вторнику, десяти часам. Две другие причины подходят к ситуации, но в записи не названы.",
            ),
        ],
    },
    "ls-reisen-verkehr-01": {
        "speakers": ["Durchsage"],
        "pace": 0.95,
        "title": ("A platform change at the station", "Смена пути на вокзале"),
        "lines": [
            ("Durchsage", "Uncle_Fu", ANNOUNCE, "Achtung am Gleis sieben."),
            ("Durchsage", "Uncle_Fu", ANNOUNCE, "Der Regionalexpress nach Hamburg fährt heute nicht um sechzehn Uhr zehn, sondern um sechzehn Uhr fünfundzwanzig."),
            ("Durchsage", "Uncle_Fu", ANNOUNCE, "Der Zug fährt außerdem abweichend von Gleis neun."),
            ("Durchsage", "Uncle_Fu", ANNOUNCE, "Reisende nach Hamburg gehen bitte zu Gleis neun."),
        ],
        "questions": [
            (
                "Von welchem Gleis fährt der Zug nach Hamburg ab?",
                ["Von Gleis neun.", "Von Gleis sieben.", "Von Gleis zehn."],
                0,
                "Platform seven is where the announcement is made, not where the train leaves from — *abweichend von Gleis neun* is the change. Ten is a number in the cancelled time (*sechzehn Uhr zehn*), not a platform at all. An announcement names several numbers and only one answers the question.",
                "Путь семь — это место, где звучит объявление, а не откуда уходит поезд: изменение — *abweichend von Gleis neun*. Десять вообще не путь, а часть отменённого времени (*sechzehn Uhr zehn*). В объявлении звучит несколько чисел, и лишь одно отвечает на вопрос.",
            ),
            (
                "Wann fährt der Zug ab?",
                ["Um 16.25 Uhr.", "Um 16.10 Uhr.", "Um 16.15 Uhr."],
                0,
                "*nicht … sondern* cancels the first time and gives the new one. Whichever half of that construction you miss, you take the wrong train.",
                "*nicht … sondern* отменяет первое время и называет новое. Пропустив любую половину этой конструкции, сядешь не на тот поезд.",
            ),
        ],
    },
    "ls-gesundheit-arzttermin-01": {
        "speakers": ["Empfang", "Herr Nowak"],
        "pace": 0.95,
        "title": ("Instructions at the doctor's reception", "Указания в регистратуре"),
        "lines": [
            ("Empfang", "Ono_Anna", OFFICIAL, "Guten Morgen. Sie haben um elf Uhr einen Termin bei Frau Doktor Weber."),
            ("Herr Nowak", "Dylan", ASKING, "Ja. Muss ich noch etwas vorbereiten?"),
            ("Empfang", "Ono_Anna", OFFICIAL, "Bitte füllen Sie zuerst dieses Formular aus. Trinken Sie vorher nichts außer Wasser. Danach warten Sie im zweiten Stock vor Zimmer zwölf."),
            ("Herr Nowak", "Dylan", ASKING, "Soll ich gleich nach oben gehen?"),
            ("Empfang", "Ono_Anna", OFFICIAL, "Nein, geben Sie mir zuerst das Formular. Dann rufe ich Sie auf."),
        ],
        "questions": [
            (
                "Was soll Herr Nowak zuerst tun?",
                ["Das Formular ausfüllen.", "In den zweiten Stock gehen.", "Vor Zimmer zwölf warten."],
                0,
                "All three are real instructions from the same turn — only their order differs, and *zuerst* is said twice to fix it. The last line refuses going up straight away, which is the confirmation.",
                "Все три — настоящие указания из одной и той же реплики, различается лишь порядок, и *zuerst* звучит дважды, чтобы его закрепить. Последняя реплика отказывает в том, чтобы сразу идти наверх, — это подтверждение.",
            ),
            (
                "Was darf Herr Nowak vorher trinken?",
                ["Nur Wasser.", "Kaffee und Wasser.", "Gar nichts."],
                0,
                "*nichts außer Wasser* is a negation with an exception, and dropping the exception turns 'only water' into 'nothing at all' — the third option is exactly that mistake.",
                "*nichts außer Wasser* — отрицание с исключением; потеряв исключение, «только воду» превращаешь в «совсем ничего»: третий вариант — ровно эта ошибка.",
            ),
        ],
    },
    "ls-arbeit-beruf-01": {
        "speakers": ["Frau Behrens", "Mira"],
        "pace": 0.98,
        "title": ("A short task at work", "Короткое задание на работе"),
        "lines": [
            ("Frau Behrens", "Ryan", TEACHER, "Mira, bitte prüfe heute zuerst die neue Lieferung."),
            ("Mira", "Vivian", ASKING, "Soll ich nur die Kartons zählen?"),
            ("Frau Behrens", "Ryan", TEACHER, "Zähle die Kartons und vergleiche die Nummern mit der Liste. Beschädigte Pakete stellst du neben die Tür."),
            ("Mira", "Vivian", ASKING, "Wann muss alles fertig sein?"),
            ("Frau Behrens", "Ryan", TEACHER, "Bis zwölf Uhr. Danach schickst du mir ein Foto von der ausgefüllten Liste."),
        ],
        "questions": [
            (
                "Was soll Mira mit beschädigten Paketen machen?",
                ["Sie neben die Tür stellen.", "Sie zurückschicken.", "Sie auf die Liste schreiben."],
                0,
                "The damaged parcels get their own instruction, tucked in after two others in the same turn. The list is mentioned — but for comparing numbers, not for recording damage.",
                "Для повреждённых посылок есть отдельное указание, спрятанное после двух других в той же реплике. Список упомянут, но для сверки номеров, а не для записи повреждений.",
            ),
            (
                "Was macht Mira nach zwölf Uhr?",
                ["Sie schickt ein Foto von der Liste.", "Sie zählt die Kartons noch einmal.", "Sie ruft Frau Behrens an."],
                0,
                "*Bis zwölf Uhr* is the deadline and *danach* is what follows it — two pieces of time information in one short turn. Sending a photo is not the same as calling, though both would report back.",
                "*Bis zwölf Uhr* — это срок, а *danach* — то, что после него: две временны́е детали в одной короткой реплике. Отправить фото — не то же самое, что позвонить, хотя оба варианта означали бы отчёт.",
            ),
        ],
    },
    "ls-lernen-verstehen-01": {
        "speakers": ["Kursleiterin", "Teilnehmer"],
        "pace": 0.95,
        "title": ("Instructions for a task in class", "Указания к заданию на занятии"),
        "lines": [
            ("Kursleiterin", "Serena", TEACHER, "Öffnen Sie bitte das Kursbuch auf Seite vierunddreißig. Lesen Sie zuerst die Aufgabe zwei. Danach hören Sie den Dialog zweimal und markieren die richtigen Sätze."),
            ("Teilnehmer", "Aiden", ASKING, "Entschuldigung, ich habe den letzten Schritt nicht verstanden. Können Sie das bitte noch einmal erklären?"),
            ("Kursleiterin", "Serena", TEACHER, "Natürlich. Nach dem Hören vergleichen Sie Ihre Antworten mit Ihrer Partnerin. Erst danach öffnen Sie die Lösung."),
            ("Teilnehmer", "Aiden", ASKING, "Danke, jetzt verstehe ich die Aufgabe."),
        ],
        "questions": [
            (
                "Auf welcher Seite steht die Aufgabe?",
                ["Auf Seite 34.", "Auf Seite 24.", "Auf Seite 43."],
                0,
                "German says the units before the tens — *vierunddreißig* is literally 'four-and-thirty'. That is why 43 is the tempting wrong answer: it is what the word sounds like read straight through.",
                "В немецком единицы называются перед десятками: *vierunddreißig* — буквально «четыре и тридцать». Именно поэтому соблазнителен вариант 43: так это слово звучит, если читать его подряд.",
            ),
            (
                "Wann darf man die Lösung öffnen?",
                ["Erst nach dem Vergleich mit der Partnerin.", "Direkt nach dem Hören.", "Vor dem Hören."],
                0,
                "The participant asks precisely because the last step was unclear, and the answer inserts one more step before the solution. *Erst danach* means 'only after that' — it postpones, it does not permit.",
                "Участник переспрашивает именно потому, что последний шаг был неясен, и в ответе перед решением появляется ещё один шаг. *Erst danach* значит «только после этого» — это отсрочка, а не разрешение.",
            ),
        ],
    },
    # ---------------------------------------------------------------- B1 ----
    "ls-erfahrungen-erzaehlen-01": {
        "speakers": ["Interviewer", "Dilan"],
        "pace": 1.0,
        "title": ("An interview about a difficult time", "Интервью о трудном периоде"),
        "lines": [
            ("Interviewer", "Aiden", CALM, "Welche Erfahrung war für Sie besonders schwierig?"),
            ("Dilan", "Serena", CALM, "Vor zwei Jahren bin ich allein nach Deutschland gezogen. Zuerst kannte ich niemanden und verstand im Alltag nur wenig. Besonders schwierig war die Wohnungssuche."),
            ("Interviewer", "Aiden", CALM, "Was hat Ihnen damals geholfen?"),
            ("Dilan", "Serena", CALM, "Ich besuchte einen Sprachkurs und lernte dort eine Nachbarin kennen. Nachdem sie meine Unterlagen geprüft hatte, half sie mir bei mehreren Bewerbungen."),
            ("Interviewer", "Aiden", CALM, "Wann änderte sich die Situation?"),
            ("Dilan", "Serena", CALM, "Der Wendepunkt kam nach drei Monaten. Ich bekam eine kleine Wohnung und fand gleichzeitig eine Teilzeitstelle."),
            ("Interviewer", "Aiden", CALM, "Wie denken Sie heute über diese Zeit?"),
            ("Dilan", "Serena", CALM, "Die ersten Wochen waren anstrengend, aber ich habe es geschafft. Die Erfahrung zeigte mir, dass ich früher um Hilfe bitten sollte."),
        ],
        "questions": [
            (
                "Was war für Dilan am schwierigsten?",
                ["Die Wohnungssuche.", "Der Sprachkurs.", "Die Arbeit im Büro."],
                0,
                "*Besonders schwierig war …* singles one thing out of several hardships. The language course is named as what helped, not as what was hard — in an interview the two are easy to swap.",
                "*Besonders schwierig war …* выделяет одно из нескольких затруднений. Языковые курсы названы как то, что помогло, а не как трудность, — в интервью эти роли легко перепутать.",
            ),
            (
                "Was hat Dilan aus dieser Zeit gelernt?",
                ["Dass sie früher um Hilfe bitten sollte.", "Dass man am besten allein zurechtkommt.", "Dass ein Sprachkurs nicht nötig ist."],
                0,
                "The conclusion is the last sentence, and it inverts the story: someone who managed alone says she should have asked sooner. The second option is the moral the narrative seems to point at — and the speaker rejects it.",
                "Вывод — последняя фраза, и она переворачивает рассказ: та, кто справилась сама, говорит, что просить помощи надо было раньше. Второй вариант — та мораль, к которой рассказ будто ведёт, и говорящая её отвергает.",
            ),
        ],
    },
    "ls-lernen-zukunft-01": {
        "speakers": ["Berater", "Frau Ilić"],
        "pace": 1.0,
        "title": ("Guidance on the next professional step", "Консультация о следующем шаге в работе"),
        "lines": [
            ("Berater", "Uncle_Fu", CALM, "Was ist Ihr wichtigstes berufliches Ziel für das nächste Jahr?"),
            ("Frau Ilić", "Vivian", CALM, "Ich möchte im Büro mehr Verantwortung übernehmen. Dafür brauche ich besseres Deutsch und mehr Erfahrung mit Kunden."),
            ("Berater", "Uncle_Fu", CALM, "Dann empfehle ich Ihnen einen berufsbegleitenden B2-Kurs. Der Kurs findet zweimal pro Woche am Abend statt."),
            ("Frau Ilić", "Vivian", CALM, "Das passt, falls ich an den anderen Tagen weiterarbeiten kann. Gibt es auch praktische Übungen?"),
            ("Berater", "Uncle_Fu", CALM, "Ja. Sie üben Gespräche und schreiben echte E-Mails, damit Sie das Gelernte direkt anwenden können."),
            ("Frau Ilić", "Vivian", CALM, "Was wäre mein nächster Schritt?"),
            ("Berater", "Uncle_Fu", CALM, "Melden Sie sich zuerst zur Beratung beim Kursanbieter an. Danach können Sie mit Ihrer Chefin über einen freien Kursabend sprechen."),
        ],
        "questions": [
            (
                "Was ist Frau Ilićs erster nächster Schritt?",
                ["Sich beim Kursanbieter zur Beratung anmelden.", "Mit der Chefin über den Kursabend sprechen.", "Sich direkt für den B2-Kurs anmelden."],
                0,
                "Two steps are given in one turn, in order: *zuerst* the appointment with the provider, *danach* the conversation with the boss. Signing up for the course itself is the goal, not the step — advice sessions almost always end with this kind of ordered pair.",
                "В одной реплике названы два шага по порядку: *zuerst* — запись на консультацию у организатора курсов, *danach* — разговор с начальницей. Запись на сам курс — это цель, а не шаг; консультации почти всегда заканчиваются такой упорядоченной парой.",
            ),
            (
                "Wann findet der Kurs statt?",
                ["Zweimal pro Woche am Abend.", "Jeden Abend in der Woche.", "Zweimal pro Monat am Wochenende."],
                0,
                "Frequency and time of day arrive together in one clause, and the whole point of *berufsbegleitend* is that it fits around a working day — which is also why Frau Ilić immediately checks that she can keep working on the other days.",
                "Частота и время суток названы вместе в одном предложении, а весь смысл слова *berufsbegleitend* в том, что курс совмещается с работой, — потому госпожа Илич сразу и уточняет, сможет ли она работать в остальные дни.",
            ),
        ],
    },
}


def build(slug: str, spec: dict, base: RevisionPayload) -> RevisionPayload:
    lines = [
        Line(
            id=f"line-{index + 1}",
            speaker=speaker,
            display_text=text,
            voice=voice,
            style=style,
            pace=spec["pace"],
            # A little air between turns: a dialogue whose speakers overlap in time reads as one
            # voice-over, and the pause is where a learner catches up.
            pause_after_ms=450,
            seed=100 + index,
        )
        for index, (speaker, voice, style, text) in enumerate(spec["lines"])
    ]
    questions = [
        Question(
            id=f"q{index + 1}",
            instruction=Bilingual(
                en="Listen and choose the correct answer.",
                ru="Прослушайте и выберите правильный ответ.",
            ),
            response=SingleChoice(kind="single-choice", prompt=prompt, options=options, correct=correct),
            explain=Bilingual(en=explain_en, ru=explain_ru),
        )
        for index, (prompt, options, correct, explain_en, explain_ru) in enumerate(spec["questions"])
    ]
    return RevisionPayload.model_validate(
        base.model_dump()
        | {
            "title": {"en": spec["title"][0], "ru": spec["title"][1]},
            "speakers": spec["speakers"],
            "brief": base.brief.model_dump() | {"speaker_count": len(spec["speakers"])},
            "lines": [line.model_dump() for line in lines],
            "questions": [q.model_dump() for q in questions],
            "tts_adapter": "qwen_tts",
        }
    )


def main() -> None:
    store = Store()
    by_slug = {project.slug: project for project in store.projects()}
    for slug, spec in WAVE1.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        store.revise(project.id, build(slug, spec, payload))
        print(f"{slug}: {len(spec['lines'])} lines, {len(spec['questions'])} questions")


if __name__ == "__main__":
    main()
