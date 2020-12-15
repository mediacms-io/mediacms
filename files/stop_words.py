# -*- coding: utf-8 -*-


STOP_WORDS = set(
    """
a about above across after afterwards again against all almost alone along
already also although always am among amongst amount an and another any anyhow
anyone anything anyway anywhere are around as at
back be became because become becomes becoming been before beforehand behind
being below beside besides between beyond both bottom but by
call can cannot ca could
did do does doing done down due during
each eight either eleven else elsewhere empty enough even ever every
everyone everything everywhere except
few fifteen fifty first five for former formerly forty four from front full
further
get give go
had has have he hence her here hereafter hereby herein hereupon hers herself
him himself his how however hundred
i if in indeed into is it its itself
keep
last latter latterly least less
just
made make many may me meanwhile might mine more moreover most mostly move much
must my myself
name namely neither never nevertheless next nine no nobody none noone nor not
nothing now nowhere
of off often on once one only onto or other others otherwise our ours ourselves
out over own
part per perhaps please put
quite
rather re really regarding
same say see seem seemed seeming seems serious several she should show side
since six sixty so some somehow someone something sometime sometimes somewhere
still such
take ten than that the their them themselves then thence there thereafter
thereby therefore therein thereupon these they third this those though three
through throughout thru thus to together too top toward towards twelve twenty
two
under until up unless upon us used using
various very very via was we well were what whatever when whence whenever where
whereafter whereas whereby wherein whereupon wherever whether which while
whither who whoever whole whom whose why will with within without would
yet you your yours yourself yourselves
""".split()
)

SPANISH_STOP_WORDS = set(
    """
a actualmente acuerdo adelante ademas además adrede afirmó agregó ahi ahora ahí al algo alguna algunas alguno algunos algún alli allí alrededor ambos ampleamos antano antaño ante anterior antes apenas aproximadamente aquel aquella aquellas aquello aquellos aqui aquél aquélla aquéllas aquéllos aquí arriba arribaabajo aseguró asi así atras aun aunque ayer añadió aún
b bajo bastante bien breve buen buena buenas bueno buenos
c cada casi cerca cierta ciertas cierto ciertos cinco claro comentó como con conmigo conocer conseguimos conseguir considera consideró consigo consigue consiguen consigues contigo contra cosas creo cual cuales cualquier cuando cuanta cuantas cuanto cuantos cuatro cuenta cuál cuáles cuándo cuánta cuántas cuánto cuántos cómo
d da dado dan dar de debajo debe deben debido decir dejó del delante demasiado demás dentro deprisa desde despacio despues después detras detrás dia dias dice dicen dicho dieron diferente diferentes dijeron dijo dio donde dos durante día días dónde
e ejemplo el ella ellas ello ellos embargo empleais emplean emplear empleas empleo en encima encuentra enfrente enseguida entonces entre era erais eramos eran eras eres es esa esas ese eso esos esta estaba estabais estaban estabas estad estada estadas estado estados estais estamos estan estando estar estaremos estará estarán estarás estaré estaréis estaría estaríais estaríamos estarían estarías estas este estemos esto estos estoy estuve estuviera estuvierais estuvieran estuvieras estuvieron estuviese estuvieseis estuviesen estuvieses estuvimos estuviste estuvisteis estuviéramos estuviésemos estuvo está estábamos estáis están estás esté estéis estén estés ex excepto existe existen explicó expresó
f fin final fue fuera fuerais fueran fueras fueron fuese fueseis fuesen fueses fui fuimos fuiste fuisteis fuéramos fuésemos
g general gran grandes gueno
h ha haber habia habida habidas habido habidos habiendo habla hablan habremos habrá habrán habrás habré habréis habría habríais habríamos habrían habrías habéis había habíais habíamos habían habías hace haceis hacemos hacen hacer hacerlo haces hacia haciendo hago han has hasta hay haya hayamos hayan hayas hayáis he hecho hemos hicieron hizo horas hoy hube hubiera hubierais hubieran hubieras hubieron hubiese hubieseis hubiesen hubieses hubimos hubiste hubisteis hubiéramos hubiésemos hubo
i igual incluso indicó informo informó intenta intentais intentamos intentan intentar intentas intento ir
j junto
k
l la lado largo las le lejos les llegó lleva llevar lo los luego lugar
m mal manera manifestó mas mayor me mediante medio mejor mencionó menos menudo mi mia mias mientras mio mios mis misma mismas mismo mismos modo momento mucha muchas mucho muchos muy más mí mía mías mío míos
n nada nadie ni ninguna ningunas ninguno ningunos ningún no nos nosotras nosotros nuestra nuestras nuestro nuestros nueva nuevas nuevo nuevos nunca
o ocho os otra otras otro otros
p pais para parece parte partir pasada pasado paìs peor pero pesar poca pocas poco pocos podeis podemos poder podria podriais podriamos podrian podrias podrá podrán podría podrían poner por por qué porque posible primer primera primero primeros principalmente pronto propia propias propio propios proximo próximo próximos pudo pueda puede pueden puedo pues
q qeu que quedó queremos quien quienes quiere quiza quizas quizá quizás quién quiénes qué
r raras realizado realizar realizó repente respecto
s sabe sabeis sabemos saben saber sabes sal salvo se sea seamos sean seas segun segunda segundo según seis ser sera seremos será serán serás seré seréis sería seríais seríamos serían serías seáis señaló si sido siempre siendo siete sigue siguiente sin sino sobre sois sola solamente solas solo solos somos son soy soyos su supuesto sus suya suyas suyo suyos sé sí sólo
t tal tambien también tampoco tan tanto tarde te temprano tendremos tendrá tendrán tendrás tendré tendréis tendría tendríais tendríamos tendrían tendrías tened teneis tenemos tener tenga tengamos tengan tengas tengo tengáis tenida tenidas tenido tenidos teniendo tenéis tenía teníais teníamos tenían tenías tercera ti tiempo tiene tienen tienes toda todas todavia todavía todo todos total trabaja trabajais trabajamos trabajan trabajar trabajas trabajo tras trata través tres tu tus tuve tuviera tuvierais tuvieran tuvieras tuvieron tuviese tuvieseis tuviesen tuvieses tuvimos tuviste tuvisteis tuviéramos tuviésemos tuvo tuya tuyas tuyo tuyos tú
u ultimo un una unas uno unos usa usais usamos usan usar usas uso usted ustedes
v va vais valor vamos van varias varios vaya veces ver verdad verdadera verdadero vez vosotras vosotros voy vuestra vuestras vuestro vuestros
w
x
y ya yo
z
él éramos ésa ésas ése ésos ésta éstas éste éstos última últimas último últimos
""".split()
)

STOP_WORDS.update(SPANISH_STOP_WORDS)
contractions = ["n't", "'d", "'ll", "'m", "'re", "'s", "'ve"]
STOP_WORDS.update(contractions)

for apostrophe in ["‘", "’"]:
    for stopword in contractions:
        STOP_WORDS.add(stopword.replace("'", apostrophe))
