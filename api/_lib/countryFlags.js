// COPIA del bloque COUNTRY_CODES de src/App.jsx (líneas 115-277 a fecha de esta edición).
// Deliberadamente duplicado, no importado, porque App.jsx vive en el bundle de Create React App
// y los endpoints serverless de Vercel corren en un runtime Node separado sin acceso a src/.
// Si corriges/añades un país en App.jsx, recuerda replicar el cambio aquí también.

const COUNTRY_CODES = {
  /* Europa */
  "espana":"es","spain":"es","españa":"es",
  "france":"fr","francia":"fr",
  "italy":"it","italia":"it",
  "germany":"de","alemania":"de",
  "portugal":"pt",
  "netherlands":"nl","paises bajos":"nl","países bajos":"nl","holanda":"nl",
  "belgium":"be","belgica":"be","bélgica":"be",
  "switzerland":"ch","suiza":"ch",
  "austria":"at",
  "sweden":"se","suecia":"se",
  "norway":"no","noruega":"no",
  "denmark":"dk","dinamarca":"dk",
  "finland":"fi","finlandia":"fi",
  "ireland":"ie","irlanda":"ie",
  "iceland":"is","islandia":"is",
  "united kingdom":"gb","reino unido":"gb","gran bretana":"gb","gran bretaña":"gb","england":"gb","inglaterra":"gb","scotland":"gb","escocia":"gb","wales":"gb","gales":"gb",
  "russia":"ru","rusia":"ru",
  "ukraine":"ua","ucrania":"ua",
  "poland":"pl","polonia":"pl",
  "czech republic":"cz","republica checa":"cz","república checa":"cz","r. checa":"cz","chequia":"cz",
  "slovakia":"sk","eslovaquia":"sk",
  "hungary":"hu","hungria":"hu","hungría":"hu",
  "romania":"ro","rumania":"ro","rumanía":"ro",
  "bulgaria":"bg",
  "serbia":"rs",
  "croatia":"hr","croacia":"hr",
  "slovenia":"si","eslovenia":"si",
  "bosnia":"ba","bosnia y herzegovina":"ba","bosnia-herzegovina":"ba","bosnia and herzegovina":"ba",
  "montenegro":"me",
  "albania":"al",
  "north macedonia":"mk","macedonia del norte":"mk","macedonia":"mk",
  "kosovo":"xk",
  "greece":"gr","grecia":"gr",
  "turkey":"tr","turquia":"tr","turquía":"tr",
  "georgia":"ge",
  "armenia":"am",
  "azerbaijan":"az","azerbaiyan":"az","azerbaiyán":"az","azerbaidjan":"az",
  "moldova":"md","moldavia":"md",
  "belarus":"by","bielorrusia":"by",
  "estonia":"ee",
  "latvia":"lv","letonia":"lv",
  "lithuania":"lt","lituania":"lt",
  "luxembourg":"lu","luxemburgo":"lu",
  "cyprus":"cy","chipre":"cy",
  "malta":"mt",
  "andorra":"ad",
  "liechtenstein":"li",
  "monaco":"mc","mónaco":"mc",
  "san marino":"sm",
  "faroe islands":"fo","islas feroe":"fo",
  "gibraltar":"gi",

  /* América del Norte */
  "usa":"us","eeuu":"us","ee.uu.":"us","estados unidos":"us","united states":"us",
  "canada":"ca",
  "mexico":"mx","méxico":"mx",
  "cuba":"cu",
  "puerto rico":"pr",
  "dominican republic":"do","republica dominicana":"do","república dominicana":"do",
  "haiti":"ht","haití":"ht",
  "jamaica":"jm",
  "santa lucia":"lc","saint lucia":"lc",
  "trinidad and tobago":"tt","trinidad y tobago":"tt",
  "bahamas":"bs",
  "barbados":"bb",
  "costa rica":"cr",
  "guatemala":"gt",
  "honduras":"hn",
  "el salvador":"sv",
  "nicaragua":"ni",
  "panama":"pa","panamá":"pa",
  "dominica":"dm",
  "guyana":"gy",

  /* América del Sur */
  "brazil":"br","brasil":"br",
  "argentina":"ar",
  "colombia":"co",
  "venezuela":"ve",
  "peru":"pe","perú":"pe",
  "chile":"cl",
  "ecuador":"ec",
  "uruguay":"uy",
  "bolivia":"bo",
  "paraguay":"py",
  "suriname":"sr","surinam":"sr",

  /* África */
  "nigeria":"ng","niger":"ne",
  "senegal":"sn",
  "mali":"ml",
  "cameroon":"cm","camerun":"cm","camerún":"cm",
  "angola":"ao",
  "mozambique":"mz",
  "uganda":"ug",
  "kenya":"ke","kenia":"ke",
  "ethiopia":"et","etiopia":"et","etiopía":"et",
  "ghana":"gh",
  "antigua y barbuda":"ag","antigua and barbuda":"ag",
  "guinea ecuatorial":"gq","equatorial guinea":"gq",
  "sierra leona":"sl","sierra leone":"sl",
  "ivory coast":"ci","costa de marfil":"ci","cote d'ivoire":"ci",
  "egypt":"eg","egipto":"eg",
  "morocco":"ma","marruecos":"ma",
  "algeria":"dz","argelia":"dz",
  "tunisia":"tn","tunez":"tn","túnez":"tn","tunicia":"tn",
  "south africa":"za","sudafrica":"za","sudáfrica":"za",
  "tanzania":"tz",
  "rwanda":"rw",
  "congo":"cd","republica democratica del congo":"cd","república democrática del congo":"cd",
  "zambia":"zm",
  "zimbabwe":"zw","zimbabue":"zw",
  "guinea":"gn",
  "cape verde":"cv","cabo verde":"cv",
  "gabon":"ga","gabón":"ga",
  "benin":"bj","benín":"bj",
  "tonga":"to",
  "togo":"tg",
  "burkina faso":"bf",
  "guinea-bissau":"gw","guinea bisau":"gw","guinea-bisau":"gw",
  "camboya":"kh","cambodia":"kh",
  "libano":"lb","líbano":"lb","lebanon":"lb",
  "gambia":"gm",

  /* Asia */
  "china":"cn",
  "japan":"jp","japon":"jp","japón":"jp",
  "south korea":"kr","corea del sur":"kr","korea":"kr","corea":"kr",
  "north korea":"kp","corea del norte":"kp",
  "india":"in",
  "israel":"il",
  "iran":"ir","irán":"ir",
  "kazakhstan":"kz","kazajistan":"kz","kazajistán":"kz","kazajstan":"kz",
  "australia":"au",
  "new zealand":"nz","nueva zelanda":"nz",
  "philippines":"ph","filipinas":"ph",
  "indonesia":"id",
  "thailand":"th","tailandia":"th",
  "vietnam":"vn","vietnam":"vn",
  "malaysia":"my","malasia":"my",
  "singapore":"sg","singapur":"sg",
  "taiwan":"tw",
  "hong kong":"hk",
  "mongolia":"mn",
  "uzbekistan":"uz","uzbekistán":"uz",
  "belarus":"by",
  "syria":"sy","siria":"sy",

  /* Oceanía */
  "fiji":"fj","fiyi":"fj",
  "papua nueva guinea":"pg","papua new guinea":"pg",
  "islas virgenes de america":"vi","islas virgenes de estados unidos":"vi","islas virgenes de ee.uu.":"vi","islas virgenes de ee. uu.":"vi","islas virgenes de eeuu":"vi","us virgin islands":"vi","united states virgin islands":"vi",
  "burundi":"bi",
  "madagascar":"mg",
  "rd congo":"cd","república democrática del congo":"cd","republica democratica del congo":"cd","rdc":"cd",
  "ruanda":"rw","rwanda":"rw",
  "samoa":"ws","samoa americana":"as",
  "sudan del sur":"ss","sudán del sur":"ss","south sudan":"ss",
  "tahiti":"pf","tahití":"pf","french polynesia":"pf","polinesia francesa":"pf",
  "union sovietica":"ru","union soviética":"ru","urss":"ru","ussr":"ru","soviet union":"ru",
  "yugoslavia":"rs","checoslovaquia":"cz","czechoslovakia":"cz",
  "alemania oriental":"de","rda":"de","east germany":"de",
  "alemania occidental":"de","rfa":"de","west germany":"de",
};

function countryCode(c) {
  if (!c) return null;
  return COUNTRY_CODES[c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim()] || null;
}

// Construye el emoji de bandera regional a partir de un código ISO de 2 letras.
// Se compone de dos 'regional indicator symbols' Unicode, uno por cada letra.
function flagEmoji(isoCode) {
  if (!isoCode || isoCode.length !== 2) return "";
  const codePoints = isoCode.toUpperCase().split("").map(ch => 0x1F1E6 + (ch.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

// Entidades sin código ISO de país real (selecciones mixtas/neutrales en JJOO).
// Mismo mecanismo que en src/App.jsx (cliente) — mantener sincronizado si se añaden más casos.
const NO_COUNTRY_FLAGS = { "equipo unificado": "🏳️" };

// Dado un nombre de país en texto libre, devuelve su emoji de bandera, o cadena vacía si no se reconoce.
function countryFlag(nombrePais) {
  if (!nombrePais) return "";
  const norm = nombrePais.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();
  if (NO_COUNTRY_FLAGS[norm]) return NO_COUNTRY_FLAGS[norm];
  const code = countryCode(nombrePais);
  return code ? flagEmoji(code) : "";
}

module.exports = { COUNTRY_CODES, countryCode, flagEmoji, countryFlag };