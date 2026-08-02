"""Author Wave 2: the remaining 29 planned recordings.

Every script is written to its plan brief — level, scenario, outcome, register, speaker count —
and sized to the plan's `duration_seconds` window rather than left to come out where it comes
out. Wave 1 missed nine of its twelve windows because nobody measured the relationship between
words and seconds; this time it was measured first, from Wave 1's own dry takes:

    pace 0.90 -> 0.53 s/word     pace 0.95 -> 0.50 s/word     pace 1.00 -> 0.46 s/word

(all inclusive of the 450 ms between turns). Target word counts follow from the window, and the
levels use the paces Wave 1 established: A1 0.90, A2 0.95, B1 1.00.

CEFR discipline is the hard constraint on the German. An A1 script uses only present tense,
main-clause word order and A1 vocabulary — no Konjunktiv II politeness chunks, no Perfekt. A2
adds Perfekt, modals, separable verbs, subordinate clauses and the dative. Only B1 uses passive,
Konjunktiv II, and multi-clause argument.

Two questions per artifact, each answerable only from the audio, each distractor a mistake the
level actually makes: an adjacent number, the time that was cancelled, the person the statement
did not belong to, the step that comes second. No markdown — `explain` renders as plain text.
"""

from listening_studio.domain import Bilingual, Line, Question, RevisionPayload, SingleChoice
from listening_studio.storage import Store

# Delivery per scene. The nine timbres are fixed and none is a German native, so register has to
# be carried by `instruct`.
CASUAL = "Sprich locker und freundlich, wie im Gespräch mit einer guten Freundin."
MESSAGE = "Sprich natürlich und etwas schneller, wie in einer Sprachnachricht."
OFFICIAL = "Sprich freundlich, ruhig und sachlich, wie am Schalter einer Behörde."
TEACHER = "Sprich klar und geduldig, wie eine Lehrerin, die etwas erklärt."
ASKING = "Sprich höflich und etwas zögernd, wie jemand, der um Hilfe bittet."
CALM = "Sprich ruhig, interessiert und aufmerksam, wie in einem Interview."
SHOP = "Sprich freundlich und zügig, wie hinter einer Ladentheke."
NEIGHBOUR = "Sprich freundlich und alltagsnah, wie unter Nachbarn im Treppenhaus."
COMPLAIN = "Sprich sachlich und bestimmt, aber höflich, wie bei einer Reklamation."
INTERVIEW = "Sprich ruhig, freundlich und aufmerksam, wie in einem Vorstellungsgespräch."
REPORT = "Sprich sachlich und gleichmäßig, wie in einem kurzen Radiobericht."
DEBATE = "Sprich überlegt und engagiert, wie jemand, der seine Meinung begründet."
ADVISE = "Sprich ruhig und ermutigend, wie jemand, der einen praktischen Rat gibt."

WAVE2: dict[str, dict] = {
    # ================================================================ A1 ====
    "ls-praesens-wortstellung-01": {
        "speakers": ["Lea", "Tarek"],
        "pace": 0.90,
        "title": ("Two course partners ask each other questions", "Двое на курсе расспрашивают друг друга"),
        "lines": [
            ("Lea", "Vivian", CASUAL, "Hallo, ich bin Lea. Wie heißt du?"),
            ("Tarek", "Dylan", CASUAL, "Ich heiße Tarek. Ich komme aus Marokko."),
            ("Lea", "Vivian", CASUAL, "Wo wohnst du jetzt?"),
            ("Tarek", "Dylan", CASUAL, "Ich wohne in Hamburg. Und du?"),
            ("Lea", "Vivian", CASUAL, "Ich wohne in Bremen. Arbeitest du hier?"),
            ("Tarek", "Dylan", CASUAL, "Nein, ich studiere Informatik. Am Abend lerne ich Deutsch."),
            ("Lea", "Vivian", CASUAL, "Wie lange lernst du schon Deutsch?"),
            ("Tarek", "Dylan", CASUAL, "Seit einem Jahr."),
        ],
        "questions": [
            (
                "Woher kommt Tarek?",
                ["Aus Marokko.", "Aus Hamburg.", "Aus Bremen."],
                0,
                "Both wrong options are places that are actually named in the conversation — Hamburg is where Tarek lives now and Bremen is where Lea lives. The question is whether you heard woher (where from) rather than wo (where).",
                "Оба неверных варианта действительно звучат в разговоре: Гамбург — где Тарек живёт сейчас, Бремен — где живёт Леа. Вопрос в том, расслышали ли вы woher (откуда), а не wo (где).",
            ),
            (
                "Was macht Tarek?",
                ["Er studiert Informatik.", "Er arbeitet in Hamburg.", "Er unterrichtet Deutsch."],
                0,
                "Lea asks whether he works and the answer begins with Nein — so the correction comes immediately after the question, which is exactly where attention tends to slip. He learns German in the evening; he does not teach it.",
                "Леа спрашивает, работает ли он, и ответ начинается с Nein — поправка звучит сразу после вопроса, а именно там внимание обычно и теряется. Немецкий он вечером учит, а не преподаёт.",
            ),
        ],
    },
    "ls-artikel-genus-01": {
        "speakers": ["Kundin", "Verkäufer"],
        "pace": 0.90,
        "title": ("In the furniture shop", "В мебельном магазине"),
        "lines": [
            ("Kundin", "Serena", ASKING, "Entschuldigung, ich suche eine Lampe."),
            ("Verkäufer", "Eric", SHOP, "Die Lampen sind dort links. Brauchen Sie auch einen Tisch?"),
            ("Kundin", "Serena", ASKING, "Nein, danke. Aber ich brauche noch ein Regal."),
            ("Verkäufer", "Eric", SHOP, "Das Regal dort ist neu. Der Stuhl daneben kostet zwanzig Euro."),
            ("Kundin", "Serena", ASKING, "Gut, ich nehme das Regal."),
        ],
        "questions": [
            (
                "Was sucht die Kundin am Anfang?",
                ["Eine Lampe.", "Einen Tisch.", "Einen Stuhl."],
                0,
                "Four pieces of furniture are named in five short lines. The table is offered and refused, the chair only gets a price, and the lamp is what she came in for.",
                "В пяти коротких репликах названы четыре предмета мебели. Стол предлагают и от него отказываются, у стула лишь называют цену, а лампа — то, за чем она пришла.",
            ),
            (
                "Was kauft die Kundin?",
                ["Das Regal.", "Die Lampe.", "Den Stuhl."],
                0,
                "What she is looking for and what she buys are different things, and both are said. The last line is the one that decides it.",
                "То, что она ищет, и то, что покупает, — разные вещи, и названы обе. Решает последняя реплика.",
            ),
        ],
    },
    "ls-akkusativ-01": {
        "speakers": ["Kellner", "Gast"],
        "pace": 0.90,
        "title": ("Ordering in a café", "Заказ в кафе"),
        "lines": [
            ("Kellner", "Ryan", SHOP, "Guten Tag. Was möchten Sie trinken?"),
            ("Gast", "Ono_Anna", ASKING, "Ich nehme einen Kaffee und ein Wasser."),
            ("Kellner", "Ryan", SHOP, "Möchten Sie auch etwas essen?"),
            ("Gast", "Ono_Anna", ASKING, "Ja, ich möchte einen Salat. Ohne Zwiebeln, bitte."),
            ("Kellner", "Ryan", SHOP, "Möchten Sie den Salat mit Brot?"),
            ("Gast", "Ono_Anna", ASKING, "Nein, ohne Brot, danke."),
            ("Kellner", "Ryan", SHOP, "Einen Kaffee, ein Wasser und einen Salat. Kommt sofort."),
        ],
        "questions": [
            (
                "Was bestellt der Gast zu trinken?",
                ["Einen Kaffee und ein Wasser.", "Einen Kaffee und eine Milch.", "Ein Wasser und einen Saft."],
                0,
                "The order is said twice — once by the guest and once repeated back by the waiter. The repetition is the chance to check, and it is worth waiting for rather than answering on the first hearing.",
                "Заказ звучит дважды: сначала от гостя, потом официант его повторяет. Повтор — это возможность проверить себя, и стоит дождаться его, а не отвечать с первого раза.",
            ),
            (
                "Wie möchte der Gast den Salat?",
                ["Ohne Zwiebeln und ohne Brot.", "Mit Zwiebeln und mit Brot.", "Ohne Zwiebeln, aber mit Brot."],
                0,
                "Two separate refusals, in two different turns. The third option catches the listener who heard the first ohne and stopped listening for the second.",
                "Два отдельных отказа в двух разных репликах. Третий вариант ловит того, кто расслышал первое ohne и перестал ждать второго.",
            ),
        ],
    },
    "ls-essen-einkaufen-01": {
        "speakers": ["Verkäuferin", "Kunde"],
        "pace": 0.90,
        "title": ("At the market stall", "У продуктового прилавка"),
        "lines": [
            ("Verkäuferin", "Sohee", SHOP, "Guten Morgen! Was darf es sein?"),
            ("Kunde", "Aiden", ASKING, "Ich möchte ein Kilo Äpfel und zwei Kilo Kartoffeln."),
            ("Verkäuferin", "Sohee", SHOP, "Gern. Die Äpfel kosten drei Euro, die Kartoffeln zwei Euro fünfzig."),
            ("Kunde", "Aiden", ASKING, "Haben Sie auch Tomaten?"),
            ("Verkäuferin", "Sohee", SHOP, "Ja, aber nur noch wenige. Ein Pfund kostet zwei Euro."),
            ("Kunde", "Aiden", ASKING, "Dann nehme ich ein Pfund Tomaten. Das ist alles."),
            ("Verkäuferin", "Sohee", SHOP, "Zusammen sind das sieben Euro fünfzig."),
        ],
        "questions": [
            (
                "Wie viel kosten die Kartoffeln?",
                ["Zwei Euro fünfzig.", "Drei Euro.", "Zwei Euro."],
                0,
                "Three prices are said and each belongs to a different item — three euros for the apples, two for a pound of tomatoes. Attaching the number to the right product is the whole task.",
                "Названы три цены, и каждая относится к своему товару: три евро — яблоки, два — фунт помидоров. Задача в том, чтобы привязать число к нужному продукту.",
            ),
            (
                "Wie viel bezahlt der Kunde zusammen?",
                ["Sieben Euro fünfzig.", "Sieben Euro.", "Fünf Euro fünfzig."],
                0,
                "The total comes last, in the shortest line of the whole exchange. Five fifty is what you get if you leave out the tomatoes that were added late.",
                "Итог звучит в самом конце, в самой короткой реплике. Пять пятьдесят получается, если не учесть помидоры, добавленные позже.",
            ),
        ],
    },
    "ls-wohnen-01": {
        "speakers": ["Maklerin", "Interessent"],
        "pace": 0.90,
        "title": ("A short flat viewing", "Короткий осмотр квартиры"),
        "lines": [
            ("Maklerin", "Vivian", OFFICIAL, "Hier ist die Wohnung. Sie hat drei Zimmer."),
            ("Interessent", "Uncle_Fu", ASKING, "Wie groß ist die Küche?"),
            ("Maklerin", "Vivian", OFFICIAL, "Die Küche ist klein, aber das Wohnzimmer ist sehr groß."),
            ("Interessent", "Uncle_Fu", ASKING, "Gibt es einen Balkon?"),
            ("Maklerin", "Vivian", OFFICIAL, "Ja, der Balkon ist hinten. Das Bad hat ein Fenster."),
            ("Interessent", "Uncle_Fu", ASKING, "Und was kostet die Wohnung?"),
            ("Maklerin", "Vivian", OFFICIAL, "Sechshundert Euro im Monat, ohne Heizung."),
            ("Interessent", "Uncle_Fu", ASKING, "Das ist nicht teuer. Ich nehme sie."),
        ],
        "questions": [
            (
                "Welcher Raum ist sehr groß?",
                ["Das Wohnzimmer.", "Die Küche.", "Das Bad."],
                0,
                "Small and very large stand in the same sentence, joined by aber. Whoever hears only the first half takes the kitchen.",
                "«Маленькая» и «очень большая» стоят в одном предложении, соединённые aber. Кто расслышал только первую половину, выберет кухню.",
            ),
            (
                "Was kostet die Wohnung im Monat?",
                ["Sechshundert Euro ohne Heizung.", "Sechshundert Euro mit Heizung.", "Sechzehnhundert Euro."],
                0,
                "Two things have to survive one short line: the number, and the ohne that qualifies it. Sechshundert and sechzehnhundert differ by one syllable in the middle of the word.",
                "В одной короткой реплике нужно удержать две вещи: число и уточняющее ohne. Sechshundert и sechzehnhundert различаются одним слогом в середине слова.",
            ),
        ],
    },
    # ================================================================ A2 ====
    "ls-dativ-01": {
        "speakers": ["Herr Adam", "Frau Kern"],
        "pace": 0.95,
        "title": ("Neighbours lending things", "Соседи одалживают вещи"),
        "lines": [
            ("Herr Adam", "Eric", NEIGHBOUR, "Hallo Frau Kern, können Sie mir kurz helfen?"),
            ("Frau Kern", "Serena", NEIGHBOUR, "Klar. Was brauchen Sie denn?"),
            ("Herr Adam", "Eric", NEIGHBOUR, "Ich backe heute einen Kuchen. Können Sie mir eine Waage leihen?"),
            ("Frau Kern", "Serena", NEIGHBOUR, "Die Waage habe ich meiner Tochter gegeben. Aber ich gebe Ihnen einen Messbecher."),
            ("Herr Adam", "Eric", NEIGHBOUR, "Das hilft mir sehr. Und haben Sie vielleicht auch Zucker?"),
            ("Frau Kern", "Serena", NEIGHBOUR, "Ja, ich bringe Ihnen gleich eine Packung."),
            ("Herr Adam", "Eric", NEIGHBOUR, "Danke! Wann brauchen Sie den Messbecher zurück?"),
            ("Frau Kern", "Serena", NEIGHBOUR, "Kein Problem. Den Messbecher brauche ich erst am Wochenende."),
            ("Herr Adam", "Eric", NEIGHBOUR, "Dann bringe ich ihn Ihnen am Freitag."),
        ],
        "questions": [
            (
                "Was leiht Frau Kern ihrem Nachbarn?",
                ["Einen Messbecher.", "Eine Waage.", "Einen Kuchen."],
                0,
                "The scales are exactly what she cannot lend — she has given them to her daughter, and the replacement is offered in the same breath. The cake is what he is baking, not what he borrows.",
                "Весы — как раз то, что она одолжить не может: она отдала их дочери, и замена предлагается в той же реплике. Пирог — то, что он печёт, а не то, что берёт.",
            ),
            (
                "Wann bringt Herr Adam den Messbecher zurück?",
                ["Am Freitag.", "Am Wochenende.", "Am Montag."],
                0,
                "The weekend is when she needs it back by, so Friday is his answer to that. Hearing only one of the two days gets it wrong.",
                "Выходные — это срок, к которому мерный стакан нужен ей; пятница — его ответ на это. Кто расслышал только один из двух дней, ошибётся.",
            ),
        ],
    },
    "ls-trennbare-verben-01": {
        "speakers": ["Jonas"],
        "pace": 0.95,
        "title": ("A voice message about tomorrow", "Голосовое сообщение о завтрашнем дне"),
        "lines": [
            ("Jonas", "Dylan", MESSAGE, "Hallo Papa, hier ist Jonas. Ich rufe kurz an, weil sich mein Tag geändert hat."),
            ("Jonas", "Dylan", MESSAGE, "Ich stehe morgen schon um sechs Uhr auf und fahre um sieben zur Arbeit ab."),
            ("Jonas", "Dylan", MESSAGE, "Mittags kaufe ich für Oma ein und bringe ihr die Sachen vorbei."),
            ("Jonas", "Dylan", MESSAGE, "Um vier Uhr hole ich Mia vom Kindergarten ab."),
            ("Jonas", "Dylan", MESSAGE, "Danach räume ich die Küche auf und rufe dich noch einmal an."),
            ("Jonas", "Dylan", MESSAGE, "Bitte mach das Fenster im Wohnzimmer zu, es soll regnen. Bis morgen!"),
        ],
        "questions": [
            (
                "Wann fährt Jonas zur Arbeit ab?",
                ["Um sieben Uhr.", "Um sechs Uhr.", "Um vier Uhr."],
                0,
                "Three times, three different separable verbs: six is getting up, seven is leaving, four is the nursery pickup. Six and seven sit in the same sentence, which is why they are the easy pair to swap.",
                "Три времени и три разных отделяемых глагола: шесть — подъём, семь — отъезд, четыре — детский сад. Шесть и семь стоят в одном предложении — потому их и путают чаще всего.",
            ),
            (
                "Was soll der Vater machen?",
                ["Das Fenster im Wohnzimmer zumachen.", "Mia vom Kindergarten abholen.", "Die Küche aufräumen."],
                0,
                "Everything in the message is what Jonas himself is doing, until the last line changes to an imperative. That switch from ich to bitte mach is the only signal that a task is being handed over.",
                "Всё сообщение — о том, что делает сам Йонас, пока последняя реплика не переходит в повелительное наклонение. Переход от ich к bitte mach — единственный сигнал, что задачу передают другому.",
            ),
        ],
    },
    "ls-modalverben-01": {
        "speakers": ["Nele", "Timo"],
        "pace": 0.95,
        "title": ("House rules for a new flatmate", "Правила дома для нового соседа"),
        "lines": [
            ("Nele", "Ono_Anna", CASUAL, "Timo, wir müssen die Hausordnung noch einmal durchgehen."),
            ("Timo", "Aiden", CASUAL, "Okay. Was darf ich denn nicht?"),
            ("Nele", "Ono_Anna", CASUAL, "Im Treppenhaus darfst du nicht rauchen. Das ist verboten."),
            ("Timo", "Aiden", CASUAL, "Verstanden. Und die Waschküche?"),
            ("Nele", "Ono_Anna", CASUAL, "Da kannst du jeden Tag waschen, aber nach zweiundzwanzig Uhr darfst du die Maschine nicht mehr anstellen."),
            ("Timo", "Aiden", CASUAL, "Muss ich den Müll auch runterbringen?"),
            ("Nele", "Ono_Anna", CASUAL, "Nicht jeden Tag. Am Dienstag musst du die gelbe Tonne rausstellen."),
            ("Timo", "Aiden", CASUAL, "Und wenn ich Besuch habe?"),
            ("Nele", "Ono_Anna", CASUAL, "Das kannst du machen. Du musst nur nach zehn Uhr leise sein."),
            ("Timo", "Aiden", CASUAL, "Gut, das kann ich mir merken."),
        ],
        "questions": [
            (
                "Was ist im Treppenhaus verboten?",
                ["Rauchen.", "Waschen.", "Besuch empfangen."],
                0,
                "Washing and having visitors are both allowed, each with a time limit attached. Only one thing in the whole conversation is called verboten.",
                "И стирка, и гости разрешены — у каждого лишь своё ограничение по времени. Словом verboten во всём разговоре названо только одно.",
            ),
            (
                "Was muss Timo am Dienstag machen?",
                ["Die gelbe Tonne rausstellen.", "Die Waschmaschine anstellen.", "Jeden Tag den Müll runterbringen."],
                0,
                "The answer begins with a refusal — nicht jeden Tag — and only then names the day. The third option is what the question asked, kept as the answer instead of the correction that followed it.",
                "Ответ начинается с отрицания — nicht jeden Tag — и лишь затем называет день. Третий вариант — это сам вопрос, принятый за ответ вместо последовавшей поправки.",
            ),
        ],
    },
    "ls-perfekt-haben-sein-01": {
        "speakers": ["Rafa", "Anja"],
        "pace": 0.95,
        "title": ("A weekend in Dresden", "Выходные в Дрездене"),
        "lines": [
            ("Rafa", "Ryan", CASUAL, "Und, wie war euer Wochenende in Dresden?"),
            ("Anja", "Vivian", CASUAL, "Sehr schön! Wir sind am Freitagabend mit dem Zug gefahren."),
            ("Rafa", "Ryan", CASUAL, "Habt ihr das Hotel schnell gefunden?"),
            ("Anja", "Vivian", CASUAL, "Nein, wir sind zuerst falsch gelaufen und haben eine halbe Stunde gesucht."),
            ("Rafa", "Ryan", CASUAL, "Oh je. Und am Samstag?"),
            ("Anja", "Vivian", CASUAL, "Am Samstag haben wir die Altstadt angeschaut und sind auf einen Turm gestiegen."),
            ("Rafa", "Ryan", CASUAL, "Habt ihr auch das Museum besucht?"),
            ("Anja", "Vivian", CASUAL, "Das wollten wir, aber es war geschlossen. Deshalb sind wir an den Fluss gegangen."),
            ("Rafa", "Ryan", CASUAL, "Habt ihr Fotos gemacht?"),
            ("Anja", "Vivian", CASUAL, "Ja, über hundert. Ich schicke dir heute Abend die schönsten."),
            ("Rafa", "Ryan", CASUAL, "Und wann seid ihr zurückgekommen?"),
            ("Anja", "Vivian", CASUAL, "Am Sonntagabend. Wir haben viel gesehen und wenig geschlafen."),
        ],
        "questions": [
            (
                "Warum haben sie das Museum nicht besucht?",
                ["Es war geschlossen.", "Sie hatten keine Zeit.", "Sie sind falsch gelaufen."],
                0,
                "Getting lost really did happen, but on Friday and about the hotel. A wrong answer here is usually a real event pulled out of the wrong moment.",
                "Заблудились они на самом деле — но в пятницу и по дороге к отелю. Неверный ответ здесь обычно и есть реальное событие, взятое не из того момента.",
            ),
            (
                "Wann sind sie nach Dresden gefahren?",
                ["Am Freitagabend.", "Am Samstagmorgen.", "Am Sonntagabend."],
                0,
                "Friday evening and Sunday evening frame the whole trip and sound almost identical in the sentence rhythm. One is the departure, the other the return.",
                "Вечер пятницы и вечер воскресенья обрамляют всю поездку и звучат почти одинаково по ритму. Одно — отъезд, другое — возвращение.",
            ),
        ],
    },
    "ls-alltag-tagesablauf-01": {
        "speakers": ["Mira", "Ben"],
        "pace": 0.95,
        "title": ("Rearranging the day", "Перекраивают день"),
        "lines": [
            ("Mira", "Serena", CASUAL, "Ben, mein Termin am Nachmittag ist jetzt später."),
            ("Ben", "Eric", CASUAL, "Wie spät denn?"),
            ("Mira", "Serena", CASUAL, "Erst um halb fünf. Deshalb kann ich Lina nicht abholen."),
            ("Ben", "Eric", CASUAL, "Kein Problem, ich hole sie ab. Ich bin um drei fertig."),
            ("Mira", "Serena", CASUAL, "Super. Kannst du dann auch schnell einkaufen?"),
            ("Ben", "Eric", CASUAL, "Ja. Was brauchen wir?"),
            ("Mira", "Serena", CASUAL, "Milch, Brot und Obst. Das Gemüse habe ich schon."),
            ("Ben", "Eric", CASUAL, "Gut. Und wer kocht heute?"),
            ("Mira", "Serena", CASUAL, "Ich koche, wenn ich zu Hause bin. So gegen sechs."),
            ("Ben", "Eric", CASUAL, "Dann decke ich mit Lina den Tisch."),
            ("Mira", "Serena", CASUAL, "Denk bitte daran, dass Lina heute ihre Sportsachen braucht."),
            ("Ben", "Eric", CASUAL, "Die liegen schon im Auto. Ich habe sie gestern eingepackt."),
        ],
        "questions": [
            (
                "Wer holt Lina heute ab?",
                ["Ben.", "Mira.", "Niemand."],
                0,
                "Mira names the task only to say she cannot do it, and Ben takes it over in the next line. The handover happens across two speakers, not inside one sentence.",
                "Мира называет задачу лишь затем, чтобы сказать, что не сможет, и в следующей реплике Бен берёт её на себя. Передача происходит между двумя говорящими, а не внутри одного предложения.",
            ),
            (
                "Was muss Ben nicht kaufen?",
                ["Gemüse.", "Milch.", "Brot."],
                0,
                "Three items are on the list and a fourth is explicitly already there. The question asks for the exception, which is the word right after the list.",
                "Три позиции в списке, а четвёртая, как прямо сказано, уже есть. Вопрос — об исключении, и это слово стоит сразу после перечисления.",
            ),
        ],
    },
    "ls-wohnen-umzug-01": {
        "speakers": ["Herr Yilmaz", "Frau Dorn"],
        "pace": 0.95,
        "title": ("Arranging a moving day", "Договариваются о дне переезда"),
        "lines": [
            ("Herr Yilmaz", "Uncle_Fu", NEIGHBOUR, "Guten Tag Frau Dorn, ich ziehe am Samstag um. Ich wollte kurz Bescheid sagen."),
            ("Frau Dorn", "Sohee", NEIGHBOUR, "Danke, das ist nett. Wann kommt der Wagen?"),
            ("Herr Yilmaz", "Uncle_Fu", NEIGHBOUR, "Gegen acht Uhr morgens. Könnten Sie Ihr Auto vor dem Haus wegfahren?"),
            ("Frau Dorn", "Sohee", NEIGHBOUR, "Natürlich. Ich stelle es am Freitagabend in die Seitenstraße."),
            ("Herr Yilmaz", "Uncle_Fu", NEIGHBOUR, "Vielen Dank. Wir brauchen den Platz nur bis Mittag."),
            ("Frau Dorn", "Sohee", NEIGHBOUR, "Und der Aufzug? Der ist oft besetzt."),
            ("Herr Yilmaz", "Uncle_Fu", NEIGHBOUR, "Den habe ich für Samstag reserviert, von acht bis zwölf."),
            ("Frau Dorn", "Sohee", NEIGHBOUR, "Sehr gut. Sagen Sie Bescheid, wenn Sie noch Hilfe brauchen."),
            ("Herr Yilmaz", "Uncle_Fu", NEIGHBOUR, "Das ist lieb. Am Nachmittag wird es sicher ruhiger."),
            ("Frau Dorn", "Sohee", NEIGHBOUR, "Ich bin ab zehn zu Hause und kann Ihnen Kaffee kochen."),
        ],
        "questions": [
            (
                "Worum bittet Herr Yilmaz seine Nachbarin?",
                ["Ihr Auto wegzufahren.", "Den Aufzug zu reservieren.", "Beim Tragen zu helfen."],
                0,
                "The lift really is reserved and help really is offered — but he reserved the lift himself, and the help is her idea, not his request. Only one thing in the conversation is something he asks her to do.",
                "Лифт действительно забронирован, и помощь действительно предложена — но лифт он забронировал сам, а помощь предлагает она, а не просит он. Просьба во всём разговоре только одна.",
            ),
            (
                "Wie lange ist der Aufzug reserviert?",
                ["Von acht bis zwölf Uhr.", "Von acht bis zehn Uhr.", "Den ganzen Samstag."],
                0,
                "Ten o'clock is said too, but it is when the neighbour gets home. Four times circulate in this dialogue and each belongs to a different arrangement.",
                "Десять часов тоже звучит, но это время, когда соседка будет дома. В диалоге ходят четыре времени, и каждое относится к своей договорённости.",
            ),
        ],
    },
    "ls-einkaufen-reklamation-01": {
        "speakers": ["Kundin", "Mitarbeiter"],
        "pace": 0.95,
        "title": ("Returning a faulty kettle", "Возврат неисправного чайника"),
        "lines": [
            ("Kundin", "Vivian", COMPLAIN, "Guten Tag, ich möchte diesen Wasserkocher reklamieren."),
            ("Mitarbeiter", "Ryan", SHOP, "Was ist denn das Problem?"),
            ("Kundin", "Vivian", COMPLAIN, "Er schaltet sich nicht mehr aus. Ich habe ihn vor zwei Wochen gekauft."),
            ("Mitarbeiter", "Ryan", SHOP, "Haben Sie den Kassenbon dabei?"),
            ("Kundin", "Vivian", COMPLAIN, "Ja, hier. Ich möchte gern ein neues Gerät, kein Geld zurück."),
            ("Mitarbeiter", "Ryan", SHOP, "Das geht. Wir haben das gleiche Modell leider nicht mehr."),
            ("Kundin", "Vivian", COMPLAIN, "Und ein ähnliches?"),
            ("Mitarbeiter", "Ryan", SHOP, "Wir haben eines für fünf Euro mehr. Den Unterschied müssen Sie zahlen."),
            ("Kundin", "Vivian", COMPLAIN, "Das ist in Ordnung, wenn ich es heute mitnehmen kann."),
            ("Mitarbeiter", "Ryan", SHOP, "Ja, ich hole es aus dem Lager. Einen Moment bitte."),
            ("Kundin", "Vivian", COMPLAIN, "Und die Garantie beginnt dann neu, oder?"),
            ("Mitarbeiter", "Ryan", SHOP, "Genau, ab heute wieder zwei Jahre."),
        ],
        "questions": [
            (
                "Was möchte die Kundin?",
                ["Ein neues Gerät.", "Ihr Geld zurück.", "Eine Reparatur."],
                0,
                "She names both possibilities in one line and rejects one of them in the same breath — kein Geld zurück. The wrong option is a word she actually said.",
                "Обе возможности она называет в одной реплике и тут же одну из них отвергает — kein Geld zurück. Неверный вариант — это слово, которое действительно прозвучало.",
            ),
            (
                "Was muss die Kundin zusätzlich bezahlen?",
                ["Fünf Euro.", "Nichts.", "Zwei Jahre Garantie."],
                0,
                "The five euros arrive as a comparison — fünf Euro mehr — not as a price, and the sentence after it names who pays the difference.",
                "Пять евро появляются как сравнение — fünf Euro mehr, — а не как цена, и следующее предложение называет, кто платит разницу.",
            ),
        ],
    },
    "ls-adjektive-deklination-01": {
        "speakers": ["Jana", "Kolja"],
        "pace": 0.95,
        "title": ("Comparing two flats", "Сравнивают две квартиры"),
        "lines": [
            ("Jana", "Ono_Anna", CASUAL, "Wir haben jetzt zwei Wohnungen gesehen. Welche findest du besser?"),
            ("Kolja", "Aiden", CASUAL, "Die erste hat ein großes Wohnzimmer, aber eine sehr kleine Küche."),
            ("Jana", "Ono_Anna", CASUAL, "Stimmt. Die zweite hat einen schönen Balkon und einen hellen Flur."),
            ("Kolja", "Aiden", CASUAL, "Der Flur ist wirklich hell. Aber die alten Fenster gefallen mir nicht."),
            ("Jana", "Ono_Anna", CASUAL, "In der ersten Wohnung sind die Fenster neu."),
            ("Kolja", "Aiden", CASUAL, "Ja, und die Miete ist niedriger. Vierzig Euro weniger."),
            ("Jana", "Ono_Anna", CASUAL, "Dafür ist der Weg zur Arbeit länger."),
            ("Kolja", "Aiden", CASUAL, "Mit dem neuen Bus nicht mehr. Der fährt seit Januar direkt."),
            ("Jana", "Ono_Anna", CASUAL, "Dann nehmen wir die erste. Ich rufe morgen früh an."),
        ],
        "questions": [
            (
                "Welche Wohnung hat neue Fenster?",
                ["Die erste.", "Die zweite.", "Beide."],
                0,
                "The old windows are mentioned first, about the second flat, and the new ones come as a contrast one line later. Two flats and six features means every detail has to be filed under the right one.",
                "Сначала упоминаются старые окна — во второй квартире, — а новые появляются как противопоставление строкой позже. Две квартиры и шесть характеристик: каждую деталь нужно отнести к своей.",
            ),
            (
                "Warum ist der längere Weg zur Arbeit kein Problem mehr?",
                ["Ein neuer Bus fährt direkt.", "Die Miete ist niedriger.", "Der Flur ist hell."],
                0,
                "The objection and its answer are in two consecutive lines from different speakers. The other options are real advantages of the flat, just not answers to this objection.",
                "Возражение и ответ на него — две подряд идущие реплики разных говорящих. Другие варианты — реальные достоинства квартиры, но не ответ на это возражение.",
            ),
        ],
    },
    "ls-verben-mit-praepositionen-01": {
        "speakers": ["Sami", "Lu"],
        "pace": 0.95,
        "title": ("Worries and things to look forward to", "Тревоги и то, чего ждёшь"),
        "lines": [
            ("Sami", "Dylan", CASUAL, "Du wirkst müde. Worüber denkst du so viel nach?"),
            ("Lu", "Serena", CASUAL, "Ich denke an meine Prüfung. Ich habe Angst vor dem mündlichen Teil."),
            ("Sami", "Dylan", CASUAL, "Davor hatte ich auch Angst. Sprichst du mit deiner Lehrerin darüber?"),
            ("Lu", "Serena", CASUAL, "Noch nicht. Aber ich freue mich auf die Zeit danach."),
            ("Sami", "Dylan", CASUAL, "Worauf freust du dich am meisten?"),
            ("Lu", "Serena", CASUAL, "Auf den Urlaub. Ich warte seit Monaten darauf."),
            ("Sami", "Dylan", CASUAL, "Und auf wen wartest du am Bahnhof, wenn du fährst?"),
            ("Lu", "Serena", CASUAL, "Auf meine Schwester. Sie kommt aus Wien mit."),
            ("Sami", "Dylan", CASUAL, "Dann kümmere dich jetzt nur um die Prüfung. Um alles andere kümmern wir uns später."),
        ],
        "questions": [
            (
                "Wovor hat Lu Angst?",
                ["Vor dem mündlichen Teil der Prüfung.", "Vor der Reise nach Wien.", "Vor dem Gespräch mit der Lehrerin."],
                0,
                "Talking to the teacher is suggested, not feared, and Vienna belongs to the sister. Angst vor names one thing only, and it is said in the same line as the exam.",
                "Разговор с учительницей предлагают, а не боятся его, а Вена относится к сестре. Angst vor называет только одно, и звучит это в той же реплике, что и экзамен.",
            ),
            (
                "Auf wen wartet Lu am Bahnhof?",
                ["Auf ihre Schwester.", "Auf ihre Lehrerin.", "Auf den Urlaub."],
                0,
                "The question changes from worauf to auf wen — from a thing to a person — and the third option is the answer to the previous question. That switch is what this recording is for.",
                "Вопрос меняется с worauf на auf wen — с вещи на человека, — а третий вариант отвечает на предыдущий вопрос. Ради этого перехода запись и сделана.",
            ),
        ],
    },
    "ls-nebensaetze-plaene-01": {
        "speakers": ["Tom", "Elif"],
        "pace": 0.95,
        "title": ("Why the trip has to move", "Почему поездку переносят"),
        "lines": [
            ("Tom", "Eric", CASUAL, "Elif, wir müssen den Ausflug verschieben."),
            ("Elif", "Vivian", CASUAL, "Schade. Warum denn?"),
            ("Tom", "Eric", CASUAL, "Weil meine Schwester am Samstag ihren Umzug hat und ich helfen muss."),
            ("Elif", "Vivian", CASUAL, "Das verstehe ich. Sollen wir den Sonntag nehmen?"),
            ("Tom", "Eric", CASUAL, "Am Sonntag geht es nicht, weil das Wetter schlecht werden soll."),
            ("Elif", "Vivian", CASUAL, "Stimmt, es soll regnen. Dann vielleicht nächstes Wochenende?"),
            ("Tom", "Eric", CASUAL, "Ja. Ich frage Nils, weil er das Auto hat."),
            ("Elif", "Vivian", CASUAL, "Gut. Und ich sage im Café Bescheid, weil wir dort reserviert haben."),
            ("Tom", "Eric", CASUAL, "Danke. Wenn Nils nicht kann, fahren wir mit dem Zug."),
            ("Elif", "Vivian", CASUAL, "Das ist mir sogar lieber, weil ich dann lesen kann."),
            ("Tom", "Eric", CASUAL, "Ich schreibe dir heute Abend, sobald ich mit Nils gesprochen habe."),
        ],
        "questions": [
            (
                "Warum geht der Ausflug am Samstag nicht?",
                ["Tom hilft seiner Schwester beim Umzug.", "Das Wetter soll schlecht werden.", "Nils braucht das Auto."],
                0,
                "Five weil-clauses in ten lines, and the wrong options are two of the real ones — the weather rules out Sunday, not Saturday. Each reason has to stay attached to its own day.",
                "Пять придаточных с weil на десять реплик, и неверные варианты — две настоящие причины: погода отменяет воскресенье, а не субботу. Каждая причина должна остаться при своём дне.",
            ),
            (
                "Was macht Elif?",
                ["Sie sagt im Café Bescheid.", "Sie fragt Nils.", "Sie bestellt Zugtickets."],
                0,
                "The two tasks are handed out in consecutive lines, one each. Whoever hears only the verb and not who says it takes the wrong one.",
                "Две задачи распределяются в идущих подряд репликах, по одной на каждого. Кто слышит только глагол, но не то, кто его произносит, возьмёт не ту.",
            ),
        ],
    },
    "ls-infinitiv-mit-zu-01": {
        "speakers": ["Pia", "Marek"],
        "pace": 0.95,
        "title": ("Getting the summer party ready", "Подготовка к летнему празднику"),
        "lines": [
            ("Pia", "Sohee", CASUAL, "Wir haben noch drei Tage, um alles für das Sommerfest vorzubereiten."),
            ("Marek", "Uncle_Fu", CASUAL, "Ich habe vor, morgen die Getränke zu bestellen."),
            ("Pia", "Sohee", CASUAL, "Gut. Vergiss nicht, auch Wasser zu kaufen, um genug für alle zu haben."),
            ("Marek", "Uncle_Fu", CASUAL, "Und wer kümmert sich um die Musik?"),
            ("Pia", "Sohee", CASUAL, "Nadja hat versprochen, ihre Anlage mitzubringen."),
            ("Marek", "Uncle_Fu", CASUAL, "Dann brauchen wir nur noch jemanden, um die Tische aufzustellen."),
            ("Pia", "Sohee", CASUAL, "Ich frage den Hausmeister. Er hat angeboten, früher zu kommen."),
            ("Marek", "Uncle_Fu", CASUAL, "Perfekt. Ich versuche, bis Freitag alles fertig zu haben."),
            ("Pia", "Sohee", CASUAL, "Und denk daran, die Nachbarn einzuladen, um Ärger zu vermeiden."),
            ("Marek", "Uncle_Fu", CASUAL, "Daran habe ich schon gedacht. Die Zettel liegen im Flur."),
        ],
        "questions": [
            (
                "Wozu soll Marek Wasser kaufen?",
                ["Damit es für alle reicht.", "Weil die Getränke zu teuer sind.", "Damit die Nachbarn kommen."],
                0,
                "The purpose is attached with um … zu directly after the task. The third option borrows a purpose from the last line, where inviting the neighbours has a different one entirely.",
                "Цель присоединяется через um … zu сразу после задачи. Третий вариант заимствует цель из последней реплики, где у приглашения соседей цель совсем другая.",
            ),
            (
                "Wer bringt die Musikanlage mit?",
                ["Nadja.", "Der Hausmeister.", "Marek."],
                0,
                "Three people take on three jobs. The caretaker offered to come early and Marek is handling the drinks — the names and the tasks arrive in different lines.",
                "Трое берут на себя три дела. Комендант предложил прийти раньше, а Марек занимается напитками: имена и задачи звучат в разных репликах.",
            ),
        ],
    },
    "ls-relativsaetze-01": {
        "speakers": ["Frau Roth", "Beamter"],
        "pace": 0.95,
        "title": ("At the lost property office", "В бюро находок"),
        "lines": [
            ("Frau Roth", "Serena", ASKING, "Guten Tag, ich habe gestern meine Tasche in der Bahn vergessen."),
            ("Beamter", "Ryan", OFFICIAL, "Können Sie die Tasche beschreiben?"),
            ("Frau Roth", "Serena", ASKING, "Es ist eine braune Tasche, die einen langen Riemen hat."),
            ("Beamter", "Ryan", OFFICIAL, "Wir haben hier zwei, die braun sind. Was war darin?"),
            ("Frau Roth", "Serena", ASKING, "Ein Buch, das ich aus der Bibliothek habe, und ein blauer Schal."),
            ("Beamter", "Ryan", OFFICIAL, "Einen Moment. Ist das die Tasche, die Sie meinen?"),
            ("Frau Roth", "Serena", ASKING, "Ja! Das ist die, die ich gesucht habe. Vielen Dank."),
            ("Beamter", "Ryan", OFFICIAL, "Bitte unterschreiben Sie hier. Und zeigen Sie mir bitte einen Ausweis."),
            ("Frau Roth", "Serena", ASKING, "Hier ist mein Pass. Der Schal war ein Geschenk, deshalb bin ich so froh."),
        ],
        "questions": [
            (
                "Woran erkennt man ihre Tasche?",
                ["An dem langen Riemen.", "An der braunen Farbe.", "An dem Namen darauf."],
                0,
                "Brown is not enough and the recording says why: the office has two brown ones. The relative clause is what narrows it down, which is exactly the job this structure does.",
                "Коричневого недостаточно, и запись прямо объясняет почему: в бюро их две. Сужает круг именно придаточное определительное — в этом и состоит работа данной конструкции.",
            ),
            (
                "Was war in der Tasche?",
                ["Ein Buch und ein blauer Schal.", "Ein Buch und ein Ausweis.", "Ein Schal und ein Pass."],
                0,
                "The identity document appears later and in a different role — the official asks for it at the counter. Contents and formalities are two lists, and only one answers the question.",
                "Документ появляется позже и в другой роли: его просит служащий у стойки. Содержимое и формальности — это два разных перечня, и на вопрос отвечает только один.",
            ),
        ],
    },
    "ls-biografie-erfahrungen-01": {
        "speakers": ["Moderatorin", "Herr Costa"],
        "pace": 0.95,
        "title": ("Twenty years, told in order", "Двадцать лет, рассказанные по порядку"),
        "lines": [
            ("Moderatorin", "Vivian", CALM, "Herr Costa, Sie leben seit zwanzig Jahren in Deutschland. Wo haben Sie angefangen?"),
            ("Herr Costa", "Uncle_Fu", CALM, "Ich bin zuerst nach Bremen gekommen und habe dort in einer Bäckerei gearbeitet."),
            ("Moderatorin", "Vivian", CALM, "Und wie ging es weiter?"),
            ("Herr Costa", "Uncle_Fu", CALM, "Nach drei Jahren habe ich eine Ausbildung als Koch gemacht."),
            ("Moderatorin", "Vivian", CALM, "War das schwer neben der Arbeit?"),
            ("Herr Costa", "Uncle_Fu", CALM, "Sehr. Aber danach habe ich in Hamburg eine feste Stelle bekommen."),
            ("Moderatorin", "Vivian", CALM, "Wann ist Ihre Familie nachgekommen?"),
            ("Herr Costa", "Uncle_Fu", CALM, "Meine Frau ist zwei Jahre später gekommen, unsere Tochter ist hier geboren."),
            ("Moderatorin", "Vivian", CALM, "Und heute?"),
            ("Herr Costa", "Uncle_Fu", CALM, "Heute habe ich ein kleines Restaurant. Ich koche das, was meine Mutter gekocht hat."),
            ("Moderatorin", "Vivian", CALM, "Was war der wichtigste Schritt?"),
            ("Herr Costa", "Uncle_Fu", CALM, "Die Ausbildung. Ohne die Ausbildung gab es keine feste Stelle."),
        ],
        "questions": [
            (
                "Was hat Herr Costa zuerst gemacht?",
                ["In einer Bäckerei gearbeitet.", "Eine Ausbildung als Koch gemacht.", "Ein Restaurant eröffnet."],
                0,
                "All three happen, and the question is only about the order. Zuerst, nach drei Jahren, danach and heute are the four markers that carry it.",
                "Все три события произошли, и вопрос лишь о порядке. Несут его четыре маркера: zuerst, nach drei Jahren, danach и heute.",
            ),
            (
                "Wer ist in Deutschland geboren?",
                ["Seine Tochter.", "Seine Frau.", "Herr Costa."],
                0,
                "Wife and daughter arrive in one sentence with two different verbs — one came two years later, the other was born here. The distinction sits in the second half of the line.",
                "Жена и дочь названы в одном предложении двумя разными глаголами: одна приехала два года спустя, другая здесь родилась. Различие — во второй половине реплики.",
            ),
        ],
    },
    "ls-verbindungen-folgen-01": {
        "speakers": ["Frau Sanz", "Hausmeister"],
        "pace": 0.95,
        "title": ("A burst pipe and what follows", "Прорвало трубу — и что дальше"),
        "lines": [
            ("Frau Sanz", "Ono_Anna", ASKING, "Warum ist das Wasser im Keller abgestellt?"),
            ("Hausmeister", "Aiden", NEIGHBOUR, "Gestern Nacht ist ein Rohr geplatzt, deshalb mussten wir es abstellen."),
            ("Frau Sanz", "Ono_Anna", ASKING, "Und wie lange dauert das?"),
            ("Hausmeister", "Aiden", NEIGHBOUR, "Die Firma kommt heute Nachmittag, also haben wir am Abend wieder Wasser."),
            ("Frau Sanz", "Ono_Anna", ASKING, "Ist etwas kaputtgegangen?"),
            ("Hausmeister", "Aiden", NEIGHBOUR, "Der Boden im Keller ist nass, darum können Sie Ihre Kisten dort nicht abstellen."),
            ("Frau Sanz", "Ono_Anna", ASKING, "Meine Kisten stehen aber schon unten."),
            ("Hausmeister", "Aiden", NEIGHBOUR, "Dann holen Sie sie bitte heute noch hoch, sonst wird der Karton weich."),
            ("Frau Sanz", "Ono_Anna", ASKING, "Gut, ich mache das gleich."),
            ("Hausmeister", "Aiden", NEIGHBOUR, "Und schreiben Sie Ihren Namen darauf, damit nichts verwechselt wird."),
            ("Frau Sanz", "Ono_Anna", ASKING, "Mache ich. Sagen Sie mir Bescheid, wenn der Keller wieder trocken ist."),
        ],
        "questions": [
            (
                "Warum ist das Wasser abgestellt?",
                ["Ein Rohr ist geplatzt.", "Der Keller wird geputzt.", "Die Firma arbeitet am Boden."],
                0,
                "Cause and consequence are joined by deshalb in the very first answer. The firm is coming because of the cause, not causing it.",
                "Причина и следствие соединены словом deshalb уже в первом ответе. Фирма приезжает из-за причины, а не создаёт её.",
            ),
            (
                "Was soll Frau Sanz heute noch tun?",
                ["Ihre Kisten aus dem Keller holen.", "Neue Kartons kaufen.", "Auf die Firma warten."],
                0,
                "The instruction comes with its own consequence attached — sonst wird der Karton weich — which is a warning about the boxes she has, not an instruction to buy new ones.",
                "Указание приходит вместе со своим следствием — sonst wird der Karton weich, — и это предупреждение о её нынешних коробках, а не совет купить новые.",
            ),
        ],
    },
    "ls-man-und-besitz-01": {
        "speakers": ["Rita", "Basti"],
        "pace": 0.95,
        "title": ("Whose is what in the building", "Чьё что в доме"),
        "lines": [
            ("Rita", "Sohee", NEIGHBOUR, "Basti, wem gehört eigentlich das Fahrrad im Hof?"),
            ("Basti", "Dylan", NEIGHBOUR, "Das rote? Das ist meins. Das blaue gehört den Nachbarn oben."),
            ("Rita", "Sohee", NEIGHBOUR, "Und die Schuhe vor der Tür? Man stolpert dauernd darüber."),
            ("Basti", "Dylan", NEIGHBOUR, "Die sind nicht meine. Ich glaube, das sind Lenas."),
            ("Rita", "Sohee", NEIGHBOUR, "Dann sage ich ihr Bescheid. Hier stellt man nichts in den Flur."),
            ("Basti", "Dylan", NEIGHBOUR, "Richtig. Übrigens, ist das deine Jacke im Waschraum?"),
            ("Rita", "Sohee", NEIGHBOUR, "Nein, meine ist grün. Diese hier ist viel größer."),
            ("Basti", "Dylan", NEIGHBOUR, "Dann hängen wir einen Zettel hin. Irgendjemand vermisst sie sicher."),
        ],
        "questions": [
            (
                "Wem gehört das blaue Fahrrad?",
                ["Den Nachbarn von oben.", "Basti.", "Lena."],
                0,
                "Two bikes are separated by colour inside one line — the red one is his, the blue one is not. Lena owns the shoes, one exchange later.",
                "Два велосипеда различаются по цвету внутри одной реплики: красный — его, синий — нет. Лене принадлежит обувь, о ней говорят репликой позже.",
            ),
            (
                "Warum ist die Jacke nicht Ritas?",
                ["Ihre Jacke ist grün und kleiner.", "Ihre Jacke hängt im Flur.", "Sie hat gar keine Jacke."],
                0,
                "She gives two reasons in one short line, and the second is a comparison rather than a colour. Either one alone is enough, but you have to catch at least one.",
                "В одной короткой реплике она приводит две причины, и вторая — это сравнение, а не цвет. Достаточно любой из них, но хотя бы одну нужно расслышать.",
            ),
        ],
    },
    "ls-freunde-feste-01": {
        "speakers": ["Kata", "Ole"],
        "pace": 0.95,
        "title": ("A birthday invitation", "Приглашение на день рождения"),
        "lines": [
            ("Kata", "Serena", CASUAL, "Ole, ich lade dich zu meinem Geburtstag ein. Am Samstag in zwei Wochen."),
            ("Ole", "Eric", CASUAL, "Sehr gern! Wo feierst du denn?"),
            ("Kata", "Serena", CASUAL, "Im Garten meiner Eltern, wenn das Wetter mitspielt."),
            ("Ole", "Eric", CASUAL, "Und wenn es regnet?"),
            ("Kata", "Serena", CASUAL, "Dann gehen wir in den Partyraum im Keller. Der ist reserviert."),
            ("Ole", "Eric", CASUAL, "Soll ich etwas mitbringen?"),
            ("Kata", "Serena", CASUAL, "Bring bitte einen Salat mit. Um die Getränke kümmere ich mich."),
            ("Ole", "Eric", CASUAL, "Mache ich. Kann ich meine Freundin mitbringen?"),
            ("Kata", "Serena", CASUAL, "Klar, je mehr, desto besser. Sag mir nur bis Mittwoch Bescheid."),
            ("Ole", "Eric", CASUAL, "Alles klar. Und wann fangen wir an?"),
            ("Kata", "Serena", CASUAL, "Um sechs. Aber komm ruhig etwas früher, dann können wir noch reden."),
        ],
        "questions": [
            (
                "Was soll Ole mitbringen?",
                ["Einen Salat.", "Die Getränke.", "Einen Kuchen."],
                0,
                "Kata takes the drinks herself in the second half of the same line. The task and the thing she keeps are one sentence apart.",
                "Напитки Ката берёт на себя во второй половине той же реплики. Задание и то, что она оставляет себе, разделены одним предложением.",
            ),
            (
                "Wo wird gefeiert, wenn es regnet?",
                ["Im Partyraum im Keller.", "Im Garten der Eltern.", "In Katas Wohnung."],
                0,
                "Two places, and a condition decides between them. The garden is the plan; the cellar is the plan for rain.",
                "Два места, и выбор между ними решает условие. Сад — это план; подвал — план на случай дождя.",
            ),
        ],
    },
    "ls-aemter-dienstleistungen-01": {
        "speakers": ["Herr Demir", "Sachbearbeiterin"],
        "pace": 0.95,
        "title": ("Registering an address", "Регистрация по месту жительства"),
        "lines": [
            ("Sachbearbeiterin", "Vivian", OFFICIAL, "Guten Tag, was kann ich für Sie tun?"),
            ("Herr Demir", "Aiden", ASKING, "Ich möchte meinen Wohnsitz anmelden. Welche Unterlagen brauche ich?"),
            ("Sachbearbeiterin", "Vivian", OFFICIAL, "Ihren Pass, die Bestätigung vom Vermieter und das ausgefüllte Formular."),
            ("Herr Demir", "Aiden", ASKING, "Die Bestätigung vom Vermieter habe ich dabei. Das Formular nicht."),
            ("Sachbearbeiterin", "Vivian", OFFICIAL, "Das können Sie hier ausfüllen. Es liegt am Schalter drei."),
            ("Herr Demir", "Aiden", ASKING, "Muss meine Frau auch persönlich kommen?"),
            ("Sachbearbeiterin", "Vivian", OFFICIAL, "Nicht unbedingt. Sie brauchen dann aber eine Vollmacht von ihr."),
            ("Herr Demir", "Aiden", ASKING, "Und wie lange dauert die Bearbeitung?"),
            ("Sachbearbeiterin", "Vivian", OFFICIAL, "Die Bestätigung bekommen Sie sofort. Der Ausweis kommt in etwa drei Wochen per Post."),
            ("Herr Demir", "Aiden", ASKING, "Kostet das etwas?"),
            ("Sachbearbeiterin", "Vivian", OFFICIAL, "Die Anmeldung ist kostenlos. Nur für den Ausweis zahlen Sie siebenunddreißig Euro."),
            ("Herr Demir", "Aiden", ASKING, "Gut, dann fülle ich das Formular jetzt aus."),
        ],
        "questions": [
            (
                "Was hat Herr Demir nicht dabei?",
                ["Das ausgefüllte Formular.", "Die Bestätigung vom Vermieter.", "Seinen Pass."],
                0,
                "Three documents are listed and he answers about two of them in one line — one he has, one he does not. The nicht comes last and carries the whole answer.",
                "Перечислены три документа, и в одной реплике он отвечает про два: один есть, другого нет. Слово nicht стоит в конце и несёт весь ответ.",
            ),
            (
                "Was kostet siebenunddreißig Euro?",
                ["Der Ausweis.", "Die Anmeldung.", "Die Vollmacht."],
                0,
                "The registration is called free in the sentence immediately before the price. Two facts in one line, and the wrong answer is the one you keep if you stop at the number.",
                "Регистрация названа бесплатной в предложении прямо перед ценой. Два факта в одной реплике, и неверный ответ остаётся у того, кто остановился на числе.",
            ),
        ],
    },
    # ================================================================ B1 ====
    "ls-leben-veraendern-01": {
        "speakers": ["Nora", "Kai"],
        "pace": 1.00,
        "title": ("Should she move out of the city?", "Стоит ли ей уезжать из города?"),
        "lines": [
            ("Nora", "Serena", CASUAL, "Ich überlege ernsthaft, aus der Stadt wegzuziehen. Die Mieten sind einfach nicht mehr zu bezahlen."),
            ("Kai", "Ryan", CASUAL, "Das verstehe ich, aber überleg dir das gut. Auf dem Land brauchst du sofort ein Auto."),
            ("Nora", "Serena", CASUAL, "Das stimmt. Andererseits hätte ich für dasselbe Geld doppelt so viel Platz."),
            ("Kai", "Ryan", CASUAL, "Und wie lange wärst du dann jeden Tag unterwegs?"),
            ("Nora", "Serena", CASUAL, "Mit dem Zug ungefähr fünfzig Minuten. Im Moment brauche ich zwanzig."),
            ("Kai", "Ryan", CASUAL, "Also eine Stunde mehr pro Tag. Das klingt wenig, aber im Jahr sind das Wochen."),
            ("Nora", "Serena", CASUAL, "Dafür könnte ich im Zug arbeiten oder lesen, statt im Stau zu stehen."),
            ("Kai", "Ryan", CASUAL, "Wenn dein Chef Homeoffice erlaubt, wäre das kein Problem. Hast du ihn schon gefragt?"),
            ("Nora", "Serena", CASUAL, "Noch nicht. Ich wollte erst wissen, ob ich überhaupt etwas Passendes finde."),
            ("Kai", "Ryan", CASUAL, "Dann würde ich es andersherum machen. Frag zuerst, sonst suchst du vielleicht umsonst."),
            ("Nora", "Serena", CASUAL, "Da hast du recht. Ich rede am Montag mit ihm."),
        ],
        "questions": [
            (
                "Wie lange braucht Nora heute zur Arbeit?",
                ["Zwanzig Minuten.", "Fünfzig Minuten.", "Eine Stunde."],
                0,
                "Both numbers are in one line and only the second is the present. An hour is neither of them — it is the difference Kai works out in the next turn.",
                "Оба числа стоят в одной реплике, и настоящее время — только второе. Час — это ни то ни другое: это разница, которую Кай выводит в следующей реплике.",
            ),
            (
                "Was rät Kai ihr zuerst zu tun?",
                ["Mit dem Chef über Homeoffice sprechen.", "Eine Wohnung auf dem Land suchen.", "Ein Auto kaufen."],
                0,
                "The advice is a reversal of her own order — andersherum, frag zuerst — so the wrong option is precisely what she was going to do first.",
                "Совет переворачивает её собственный порядок действий — andersherum, frag zuerst, — поэтому неверный вариант и есть то, с чего она собиралась начать.",
            ),
        ],
    },
    "ls-gesundheit-wohlbefinden-01": {
        "speakers": ["Herr Klein", "Beraterin"],
        "pace": 1.00,
        "title": ("Small changes to the day", "Небольшие перемены в распорядке дня"),
        "lines": [
            ("Herr Klein", "Uncle_Fu", ASKING, "In letzter Zeit bin ich abends völlig erschöpft, obwohl ich eigentlich genug schlafe."),
            ("Beraterin", "Ono_Anna", ADVISE, "Wie sieht denn ein normaler Tag bei Ihnen aus?"),
            ("Herr Klein", "Uncle_Fu", ASKING, "Ich sitze acht Stunden am Schreibtisch und esse meistens am Computer."),
            ("Beraterin", "Ono_Anna", ADVISE, "Das ist schon ein Teil der Antwort. Bewegung fehlt, und die Pause auch."),
            ("Herr Klein", "Uncle_Fu", ASKING, "Für Sport habe ich wirklich keine Zeit."),
            ("Beraterin", "Ono_Anna", ADVISE, "Es muss kein Sport sein. Viele merken schon einen Unterschied, wenn sie zweimal am Tag zehn Minuten zu Fuß gehen."),
            ("Herr Klein", "Uncle_Fu", ASKING, "So wenig soll etwas bringen?"),
            ("Beraterin", "Ono_Anna", ADVISE, "Regelmäßig ist wichtiger als lang. Wer einmal pro Woche eine Stunde läuft, hält das selten durch."),
            ("Herr Klein", "Uncle_Fu", ASKING, "Und das Essen am Schreibtisch?"),
            ("Beraterin", "Ono_Anna", ADVISE, "Versuchen Sie, wenigstens einmal am Tag woanders zu essen. Der Kopf braucht die Unterbrechung genauso wie der Körper."),
            ("Herr Klein", "Uncle_Fu", ASKING, "Das klingt machbar. Womit soll ich anfangen?"),
            ("Beraterin", "Ono_Anna", ADVISE, "Mit dem Spaziergang nach dem Mittagessen. Eine Sache reicht für den Anfang."),
        ],
        "questions": [
            (
                "Womit soll Herr Klein anfangen?",
                ["Mit einem Spaziergang nach dem Mittagessen.", "Mit zweimal Sport pro Woche.", "Mit früherem Schlafengehen."],
                0,
                "Several suggestions are made across the conversation, and the last line picks exactly one of them to start with. Sleep is ruled out in his very first sentence.",
                "За разговор звучит несколько советов, и последняя реплика выбирает из них ровно один, с которого начать. Сон исключён уже в его первой фразе.",
            ),
            (
                "Warum hilft eine Stunde pro Woche weniger?",
                ["Weil man es selten durchhält.", "Weil eine Stunde zu anstrengend ist.", "Weil man dabei keine Pause macht."],
                0,
                "The principle is stated first and the example follows it: regelmäßig ist wichtiger als lang. The reason is about keeping it up, not about effort.",
                "Сначала звучит принцип, а пример следует за ним: regelmäßig ist wichtiger als lang. Причина — в том, чтобы выдержать режим, а не в нагрузке.",
            ),
        ],
    },
    "ls-arbeit-bewerbung-01": {
        "speakers": ["Frau Baumann", "Frau Petrova"],
        "pace": 1.00,
        "title": ("An excerpt from a job interview", "Отрывок из собеседования"),
        "lines": [
            ("Frau Baumann", "Vivian", INTERVIEW, "Frau Petrova, Sie haben zuletzt drei Jahre in einem Logistikunternehmen gearbeitet. Warum möchten Sie wechseln?"),
            ("Frau Petrova", "Sohee", INTERVIEW, "Die Arbeit hat mir gefallen, aber ich hatte kaum Kontakt zu Kunden. Genau das reizt mich an Ihrer Stelle."),
            ("Frau Baumann", "Vivian", INTERVIEW, "Unsere Kunden rufen oft an, wenn etwas schiefgegangen ist. Wie gehen Sie mit Beschwerden um?"),
            ("Frau Petrova", "Sohee", INTERVIEW, "Ich höre erst zu Ende zu und wiederhole dann, was ich verstanden habe. Meistens beruhigt das schon."),
            ("Frau Baumann", "Vivian", INTERVIEW, "Und wenn Sie die Lösung nicht selbst entscheiden dürfen?"),
            ("Frau Petrova", "Sohee", INTERVIEW, "Dann sage ich das offen und nenne einen Zeitpunkt, bis wann ich zurückrufe. Falsche Versprechen ärgern die Kunden mehr als eine Verzögerung."),
            ("Frau Baumann", "Vivian", INTERVIEW, "Das sehe ich genauso. Wo sehen Sie Ihre größte Schwäche?"),
            ("Frau Petrova", "Sohee", INTERVIEW, "Ich arbeite manchmal zu lange an Details. Ich setze mir inzwischen feste Zeiten, damit das nicht passiert."),
            ("Frau Baumann", "Vivian", INTERVIEW, "Eine letzte Frage: Ab wann könnten Sie anfangen?"),
            ("Frau Petrova", "Sohee", INTERVIEW, "Ich habe vier Wochen Kündigungsfrist, also ab dem ersten Oktober."),
            ("Frau Baumann", "Vivian", INTERVIEW, "Gut. Wir melden uns bis Ende der Woche bei Ihnen."),
        ],
        "questions": [
            (
                "Warum möchte Frau Petrova wechseln?",
                ["Sie möchte mehr Kontakt zu Kunden.", "Die Arbeit hat ihr nicht gefallen.", "Sie verdient zu wenig."],
                0,
                "Her answer opens by contradicting the second option outright — die Arbeit hat mir gefallen — before naming the real reason. The aber is the hinge the whole answer turns on.",
                "Её ответ начинается с прямого опровержения второго варианта — die Arbeit hat mir gefallen — и лишь затем называет настоящую причину. Всё держится на этом aber.",
            ),
            (
                "Was macht sie, wenn sie nicht selbst entscheiden darf?",
                ["Sie sagt es offen und nennt einen Rückrufzeitpunkt.", "Sie verspricht eine schnelle Lösung.", "Sie gibt den Anruf sofort weiter."],
                0,
                "The second option is what she explicitly avoids: falsche Versprechen ärgern die Kunden mehr. The recording names the wrong strategy right after the right one.",
                "Второй вариант — как раз то, чего она избегает: falsche Versprechen ärgern die Kunden mehr. Запись называет неверную стратегию сразу после верной.",
            ),
        ],
    },
    "ls-meinung-medien-01": {
        "speakers": ["Sprecher", "Herr Lang", "Frau Ott"],
        "pace": 1.00,
        "title": ("A report and two reactions", "Сюжет и две реакции"),
        "lines": [
            ("Sprecher", "Eric", REPORT, "In unserer Stadt sollen ab Januar mehrere Straßen in der Innenstadt für Autos gesperrt werden. Die Verwaltung rechnet mit weniger Verkehr und besserer Luft und will die Flächen für Cafés und Fahrräder nutzen. Der Handelsverband warnt dagegen vor Umsatzverlusten, weil Kunden schlechter parken können. Wir haben zwei Stimmen dazu gesammelt."),
            ("Herr Lang", "Aiden", DEBATE, "Ich halte das für richtig. In anderen Städten hat sich gezeigt, dass die Geschäfte nach einem Jahr sogar mehr verkaufen, weil mehr Leute zu Fuß vorbeikommen und länger bleiben. Wer mit dem Auto kommt, hält kurz und fährt wieder weg."),
            ("Frau Ott", "Ono_Anna", DEBATE, "Das mag in großen Städten stimmen. Bei uns kommen viele Kunden aber aus den Dörfern, und dorthin fährt abends kaum ein Bus. Wenn man ihnen die Zufahrt nimmt, bevor es eine Alternative gibt, fahren sie eben ins Einkaufszentrum."),
            ("Herr Lang", "Aiden", DEBATE, "Dann muss man zuerst die Busse verbessern und danach sperren, nicht umgekehrt. Da bin ich ganz bei Ihnen."),
            ("Frau Ott", "Ono_Anna", DEBATE, "Genau das ist mein Punkt. Ich bin nicht gegen die Idee, sondern gegen den Zeitplan."),
            ("Sprecher", "Eric", REPORT, "Die Entscheidung fällt im Stadtrat am zwanzigsten November."),
        ],
        "questions": [
            (
                "Worin sind sich Herr Lang und Frau Ott einig?",
                ["Die Busse müssen vor der Sperrung besser werden.", "Die Innenstadt soll gar nicht gesperrt werden.", "Die Geschäfte verlieren auf jeden Fall Umsatz."],
                0,
                "The agreement arrives late and quietly, after two turns that sound like disagreement. Da bin ich ganz bei Ihnen and genau das ist mein Punkt are the two lines that mark it.",
                "Согласие приходит поздно и негромко, после двух реплик, звучащих как спор. Отмечают его именно фразы da bin ich ganz bei Ihnen и genau das ist mein Punkt.",
            ),
            (
                "Was befürchtet der Handelsverband?",
                ["Umsatzverluste, weil Kunden schlechter parken können.", "Mehr Verkehr in den Dörfern.", "Höhere Mieten in der Innenstadt."],
                0,
                "This is in the report itself, before either opinion, and it is the only claim in the whole recording attributed to the trade association rather than to a speaker.",
                "Это сказано в самом сюжете, ещё до обоих мнений, и это единственное утверждение во всей записи, приписанное торговому союзу, а не кому-то из говорящих.",
            ),
        ],
    },
    "ls-konsum-umwelt-01": {
        "speakers": ["Rolf", "Ida"],
        "pace": 1.00,
        "title": ("What happens to the bottle bank", "Что происходит со стеклотарой"),
        "lines": [
            ("Rolf", "Dylan", CASUAL, "Weißt du eigentlich, was mit unserem Altglas passiert, nachdem wir es in den Container geworfen haben?"),
            ("Ida", "Serena", TEACHER, "Es wird nach Farben sortiert, gereinigt und dann eingeschmolzen. Aus Altglas wird wieder Glas, und das fast beliebig oft."),
            ("Rolf", "Dylan", CASUAL, "Das klingt fast zu gut. Wo ist der Haken?"),
            ("Ida", "Serena", TEACHER, "Das Einschmelzen braucht sehr viel Energie. Trotzdem lohnt es sich, weil neues Glas aus Sand noch mehr Energie kostet."),
            ("Rolf", "Dylan", CASUAL, "Und wie ist das bei Plastik?"),
            ("Ida", "Serena", TEACHER, "Da wird das meiste nicht wieder zu Verpackung, sondern verbrannt. Nur ein Teil wird zu Bänken oder Rohren."),
            ("Rolf", "Dylan", CASUAL, "Dann wäre eine Mehrwegflasche also besser als eine Plastikflasche zum Wegwerfen?"),
            ("Ida", "Serena", TEACHER, "In der Regel ja, aber nur wenn sie aus der Nähe kommt. Eine Mehrwegflasche, die dreihundert Kilometer transportiert wird, verliert ihren Vorteil schnell."),
            ("Rolf", "Dylan", CASUAL, "Das heißt, die Entfernung entscheidet mehr als das Material?"),
            ("Ida", "Serena", TEACHER, "Bei den Getränken oft, ja. Am wenigsten Aufwand macht immer das, was man gar nicht erst kauft."),
        ],
        "questions": [
            (
                "Warum lohnt sich das Einschmelzen trotzdem?",
                ["Neues Glas aus Sand kostet noch mehr Energie.", "Das Einschmelzen braucht wenig Energie.", "Altglas muss nicht sortiert werden."],
                0,
                "The line concedes the objection and then overrides it: viel Energie, trotzdem, weil … noch mehr. Both halves are needed, and the second option is the first half misheard as the conclusion.",
                "Реплика сначала признаёт возражение, а затем его перекрывает: viel Energie, trotzdem, weil … noch mehr. Нужны обе половины, а второй вариант — это первая половина, принятая за вывод.",
            ),
            (
                "Wann verliert eine Mehrwegflasche ihren Vorteil?",
                ["Wenn sie weit transportiert wird.", "Wenn sie aus Plastik ist.", "Wenn sie oft gereinigt wird."],
                0,
                "The answer is yes with a condition attached — in der Regel ja, aber nur wenn — and the condition is the part that matters. A relative clause then names the distance.",
                "Ответ — «да» с условием: in der Regel ja, aber nur wenn, — и значимо именно условие. Расстояние затем называет придаточное определительное.",
            ),
        ],
    },
    "ls-regeln-verantwortung-01": {
        "speakers": ["Frau Vogt", "Herr Simon", "Frau Adamu"],
        "pace": 1.00,
        "title": ("Negotiating the rehearsal times", "Договариваются о времени репетиций"),
        "lines": [
            ("Frau Vogt", "Vivian", OFFICIAL, "Ich habe Sie beide gebeten zu kommen, weil sich mehrere Nachbarn über die Musik am Wochenende beschwert haben. In der Hausordnung steht: nach zweiundzwanzig Uhr Zimmerlautstärke."),
            ("Herr Simon", "Ryan", DEBATE, "Mir ist klar, dass es zu laut war. Aber ich probe nur samstags, weil ich unter der Woche bis acht arbeite."),
            ("Frau Adamu", "Ono_Anna", DEBATE, "Das Problem ist nicht der Samstag, sondern die Uhrzeit. Bei uns schlafen zwei kleine Kinder ab halb neun."),
            ("Herr Simon", "Ryan", DEBATE, "Wenn ich früher anfange, komme ich kaum auf zwei Stunden."),
            ("Frau Vogt", "Vivian", OFFICIAL, "Zwei Stunden müssen es ja nicht am Stück sein. Wäre samstags von fünfzehn bis siebzehn Uhr denkbar?"),
            ("Herr Simon", "Ryan", DEBATE, "Das ginge, wenn ich dafür sonntags noch eine Stunde dazubekomme."),
            ("Frau Adamu", "Ono_Anna", DEBATE, "Sonntagvormittag wäre für uns in Ordnung, da sind wir sowieso draußen."),
            ("Herr Simon", "Ryan", DEBATE, "Dann sagen wir sonntags von elf bis zwölf."),
            ("Frau Vogt", "Vivian", OFFICIAL, "Gut. Ich halte das schriftlich fest und hänge es aus, damit alle es wissen. Wenn es wieder Beschwerden gibt, reden wir noch einmal."),
            ("Frau Adamu", "Ono_Anna", DEBATE, "Und wenn Sie einmal länger proben müssen, klingeln Sie einfach vorher bei uns."),
            ("Herr Simon", "Ryan", DEBATE, "Das mache ich. Danke, dass Sie so entgegenkommend sind."),
        ],
        "questions": [
            (
                "Wann darf Herr Simon jetzt samstags proben?",
                ["Von fünfzehn bis siebzehn Uhr.", "Von elf bis zwölf Uhr.", "Bis zweiundzwanzig Uhr."],
                0,
                "Four times circulate here and only one belongs to Saturday. Eleven to twelve is the Sunday hour agreed two lines later, and twenty-two is the rule that was broken.",
                "Здесь ходят четыре времени, и к субботе относится только одно. С одиннадцати до двенадцати — воскресный час, согласованный двумя репликами позже, а двадцать два — нарушенное правило.",
            ),
            (
                "Was schlägt Frau Adamu am Ende vor?",
                ["Er soll vorher klingeln, wenn er länger probt.", "Er soll leiser spielen.", "Er soll nur noch sonntags proben."],
                0,
                "The offer comes after the agreement is already settled and goes beyond it — it is a concession, not a condition. Whoever stops listening once the times are fixed misses it.",
                "Предложение звучит уже после того, как договорённость достигнута, и выходит за её рамки: это уступка, а не условие. Кто перестал слушать, когда время согласовали, его пропустит.",
            ),
        ],
    },
    "ls-reisen-probleme-01": {
        "speakers": ["Frau Kraus", "Mitarbeiter"],
        "pace": 1.00,
        "title": ("Claiming after a missed connection", "Компенсация за пропущенную пересадку"),
        "lines": [
            ("Frau Kraus", "Sohee", COMPLAIN, "Guten Tag, ich rufe an, weil mein Zug gestern in Fulda eine Stunde stehen geblieben ist und ich meinen Anschluss verpasst habe."),
            ("Mitarbeiter", "Aiden", OFFICIAL, "Das tut mir leid. Haben Sie die Fahrkarte und die Zugnummer zur Hand?"),
            ("Frau Kraus", "Sohee", COMPLAIN, "Ja, ICE sechshundertzwölf, gebucht für den ersten August, achtzehn Uhr vierzig."),
            ("Mitarbeiter", "Aiden", OFFICIAL, "Danke. Ich sehe die Verspätung im System: einundsiebzig Minuten am Ziel."),
            ("Frau Kraus", "Sohee", COMPLAIN, "Ich musste dann ein Hotel nehmen, weil um Mitternacht nichts mehr fuhr."),
            ("Mitarbeiter", "Aiden", OFFICIAL, "Ab sechzig Minuten bekommen Sie fünfundzwanzig Prozent des Fahrpreises zurück. Die Hotelkosten werden bis achtzig Euro erstattet, wenn Sie die Rechnung einreichen."),
            ("Frau Kraus", "Sohee", COMPLAIN, "Die Rechnung war siebenundneunzig Euro."),
            ("Mitarbeiter", "Aiden", OFFICIAL, "Dann werden achtzig davon übernommen. Bitte laden Sie die Rechnung und die Fahrkarte im Formular hoch."),
            ("Frau Kraus", "Sohee", COMPLAIN, "Und wie lange dauert die Bearbeitung?"),
            ("Mitarbeiter", "Aiden", OFFICIAL, "In der Regel zwei bis drei Wochen. Sie bekommen eine Bestätigung per E-Mail, sobald der Antrag eingegangen ist."),
            ("Frau Kraus", "Sohee", COMPLAIN, "Gut. Muss ich das Original der Rechnung aufheben?"),
            ("Mitarbeiter", "Aiden", OFFICIAL, "Bitte ja, bis das Geld auf Ihrem Konto ist."),
        ],
        "questions": [
            (
                "Wie viel bekommt Frau Kraus für das Hotel zurück?",
                ["Achtzig Euro.", "Siebenundneunzig Euro.", "Fünfundzwanzig Euro."],
                0,
                "Ninety-seven is what she paid and eighty is the ceiling, stated one line before it. Twenty-five is not euros at all — it is the percentage of the fare.",
                "Девяносто семь — это её расходы, а восемьдесят — потолок, названный репликой раньше. Двадцать пять — вообще не евро, а процент от стоимости билета.",
            ),
            (
                "Was muss Frau Kraus aufheben?",
                ["Das Original der Rechnung.", "Nur die Fahrkarte.", "Die Bestätigungs-E-Mail."],
                0,
                "The last exchange answers this, and the answer has a time limit attached — bis das Geld auf Ihrem Konto ist. Ticket and confirmation both appear earlier in other roles.",
                "Отвечает последняя пара реплик, и у ответа есть срок: bis das Geld auf Ihrem Konto ist. Билет и подтверждение упоминались раньше и в других ролях.",
            ),
        ],
    },
}


def build(spec: dict, base: RevisionPayload) -> RevisionPayload:
    lines = [
        Line(
            id=f"line-{index + 1}",
            speaker=speaker,
            display_text=text,
            voice=voice,
            style=style,
            pace=spec["pace"],
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
            "authoring": "manual",
        }
    )


def main() -> None:
    store = Store()
    by_slug = {project.slug: project for project in store.projects()}
    for slug, spec in WAVE2.items():
        project = by_slug[slug]
        _, _, payload = store.get(project.id)
        store.revise(project.id, build(spec, payload))
        words = sum(len(text.split()) for *_, text in spec["lines"])
        estimate = words * (0.53 if spec["pace"] <= 0.91 else 0.50 if spec["pace"] <= 0.96 else 0.46)
        print(f"{slug:34s} {len(spec['lines']):2d} lines {words:4d} words  ~{estimate:5.1f}s")


if __name__ == "__main__":
    main()
