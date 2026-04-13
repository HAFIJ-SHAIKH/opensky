/* ═══════════════════════════════════════════════════════
 * tools.js — 27 tools with timeout, smart matchers,
 * chaining hints, and robust error handling
 * ═══════════════════════════════════════════════════════ */
(function () {
  'use strict';

  /* ── Fetch with 8s timeout ───────────────────────── */
  function tfetch(url, opts) {
    return Promise.race([
      fetch(url, opts),
      new Promise(function (_, rej) { setTimeout(function () { rej(new Error('Timeout')); }, 8000); })
    ]);
  }

  /* ── Safe JSON parse helper ──────────────────────── */
  function sj(r) { return r.json().catch(function () { return {}; }); }

  /* ── Simple hash for memory keys ──────────────────── */
  function simpleHash(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
    return 'mem_' + Math.abs(h).toString(36);
  }

  /* ── Country list for smart matching ──────────────── */
  var COUNTRIES = [
    'japan','china','india','usa','uk','united states','united kingdom','germany','france',
    'brazil','canada','australia','russia','mexico','south korea','italy','spain','netherlands',
    'switzerland','sweden','norway','denmark','finland','ireland','poland','portugal','belgium',
    'austria','singapore','malaysia','thailand','vietnam','indonesia','philippines','new zealand',
    'argentina','colombia','chile','peru','egypt','south africa','nigeria','kenya','ghana',
    'turkey','saudi arabia','uae','israel','pakistan','bangladesh','nepal','sri lanka',
    'myanmar','cambodia','laos','cuba','jamaica','iceland','greece','czech republic','romania',
    'hungary','ukraine','croatia','serbia','morocco','ethiopia','tanzania','uganda','rwanda'
  ];

  function isCountry(s) {
    var low = s.toLowerCase().trim();
    for (var i = 0; i < COUNTRIES.length; i++) {
      if (low === COUNTRIES[i]) return true;
    }
    for (var j = 0; j < COUNTRIES.length; j++) {
      var escaped = COUNTRIES[j].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re1 = new RegExp('(?:^|\\s)' + low.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?:\\s|$)', 'i');
      if (re1.test(COUNTRIES[j])) return true;
      var re2 = new RegExp('(?:^|\\s)' + escaped + '(?:\\s|$)', 'i');
      if (re2.test(low)) return true;
    }
    return false;
  }

  /* ── Fisher-Yates shuffle ────────────────────────── */
  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
  }

  /* ── UUID v4 ─────────────────────────────────────── */
  function genUUID() {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    var buf = new Uint8Array(16);
    crypto.getRandomValues(buf);
    buf[6] = (buf[6] & 0x0f) | 0x40;
    buf[8] = (buf[8] & 0x3f) | 0x80;
    var hex = Array.from(buf).map(function (b) { return b.toString(16).padStart(2, '0'); }).join('');
    return hex.slice(0, 8) + '-' + hex.slice(8, 12) + '-' + hex.slice(12, 16) + '-' + hex.slice(16, 20) + '-' + hex.slice(20);
  }

  /* ═══════════════════════════════════════════════════
   *  TOOL DEFINITIONS
   * ═══════════════════════════════════════════════════ */

  var T = [

    /* ── LOCATION / GEOGRAPHY ──────────────────────── */

    {
      id: 'weather', name: 'Weather', icon: '\u2600\uFE0F',
      match: function (t) {
        var m = t.match(/(?:weather|temperature|forecast|rain(?:ing)?|snow(?:ing)?|humid|wind(?:y)?|climate|hot|cold|warm|freezing)\s+(?:in|at|for|of|like)?\s*(.+?)(?:\s+(?:and|but|also|plus|right now|today|tonight|tomorrow)\s|$)/i);
        if (m && m[1].trim().length > 1) return m[1].replace(/[?.!,]+$/, '').trim();
        var m2 = t.match(/(?:how\s+(?:hot|cold|warm)|is\s+it\s+(?:rain|snow|sunny)|will\s+it\s+(?:rain|snow))\s+(?:in|at)\s*(.+?)[?.!,\s]*$/i);
        if (m2 && m2[1].trim().length > 1) return m2[1].replace(/[?.!,]+$/, '').trim();
        return null;
      },
      exec: function (q) {
        return tfetch('https://wttr.in/' + encodeURIComponent(q) + '?format=j1')
          .then(sj)
          .then(function (d) {
            var c = d.current_condition ? d.current_condition[0] : null;
            if (!c) return 'Weather unavailable for: ' + q;
            var desc = c.weatherDesc ? c.weatherDesc[0].value : 'Unknown';
            var windDir = c.winddir16Point || '';
            return '**' + q + '**: ' + c.temp_C + '\u00B0C (feels ' + c.FeelsLikeC + '\u00B0C) \u2014 ' + desc +
              '\nHumidity: ' + c.humidity + '% | Wind: ' + c.windspeedKmph + ' km/h ' + windDir +
              ' | Visibility: ' + c.visibility + ' km | Pressure: ' + c.pressure + ' mb' +
              (c.uvIndex !== undefined ? ' | UV: ' + c.uvIndex : '') +
              (c.cloudcover !== undefined ? ' | Cloud: ' + c.cloudcover + '%' : '');
          })
          .catch(function () { return 'Could not fetch weather for: ' + q; });
      }
    },

    {
      id: 'country', name: 'Countries', icon: '\uD83C\uDF0D',
      match: function (t) {
        var m = t.match(/(?:population|capital|currency|language|gdp|area|region|time ?zone|flag|independence|continent)\s+(?:of|for|in)\s+(?:the\s+)?(.+?)(?:\s+(?:and|but|also)\s|$)/i);
        if (m) return m[1].replace(/[?.!,]+$/, '').trim();
        var m2 = t.match(/(?:info|details?|facts?|tell me|about)\s+(?:about\s+)?(?:the\s+)?(?:country\s+)?(.+?)(?:\s+(?:and|but|also)\s|$)/i);
        if (m2 && isCountry(m2[1])) return m2[1].replace(/[?.!,]+$/, '').trim();
        return null;
      },
      exec: function (q) {
        return tfetch('https://restcountries.com/v3.1/name/' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.length || d.message) return 'Country not found: ' + q + '. Try the full country name.';
            var c = d[0], n = c.name || {};
            var out = '**' + (n.common || q) + '**' + (n.official ? ' (' + n.official + ')' : '');
            out += '\nCapital: ' + (c.capital ? c.capital[0] : 'N/A');
            out += ' | Population: ' + ((c.population || 0) / 1e6).toFixed(2) + 'M';
            out += ' | Region: ' + (c.region || 'N/A') + (c.subregion ? ' (' + c.subregion + ')' : '');
            out += '\nLanguages: ' + Object.values(c.languages || {}).join(', ');
            out += '\nCurrencies: ' + Object.values(c.currencies || {}).map(function (x) { return x.name + (x.symbol ? ' (' + x.symbol + ')' : ''); }).join(', ');
            out += '\nArea: ' + ((c.area || 0) / 1e6).toFixed(2) + ' km\u00B2';
            if (c.timezones) out += '\nTimezones: ' + c.timezones.join(', ');
            if (c.startOfWeek) out += '\nStart of week: ' + c.startOfWeek;
            if (c.demonyms && c.demonyms.eng) out += '\nDemonym: ' + (c.demonyms.eng.m || 'N/A');
            if (c.car) out += '\nDriving side: ' + (c.car.side || 'N/A');
            out += '\n[CHAIN: Use weather tool for capital ' + (c.capital ? c.capital[0] : '') + ']';
            return out;
          })
          .catch(function () { return 'Could not fetch country data for: ' + q; });
      }
    },

    {
      id: 'ip', name: 'IP Location', icon: '\uD83D\uDCCD',
      match: function (t) { return /(?:my\s+ip|ip\s*address|where\s*am\s*i|my\s*location|my\s*city|my\s*country|detect\s*my)/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://ipapi.co/json/')
          .then(sj)
          .then(function (d) {
            return '**IP:** ' + d.ip +
              '\n**City:** ' + (d.city || 'N/A') + ', ' + (d.region || 'N/A') +
              '\n**Country:** ' + (d.country_name || 'N/A') + ' (' + d.country_code + ')' +
              '\n**ISP:** ' + (d.org || 'N/A') +
              '\n**Timezone:** ' + (d.timezone || 'N/A') +
              '\n**Coordinates:** ' + d.latitude + ', ' + d.longitude +
              '\n**Postal:** ' + (d.postal || 'N/A');
          })
          .catch(function () { return 'Could not fetch IP location.'; });
      }
    },

    {
      id: 'uni', name: 'Universities', icon: '\uD83C\uDF93',
      match: function (t) { var m = t.match(/(?:universit(?:y|ies)|college|school)\s+(?:in|at|of)\s+(.+)/i); return m ? m[1].replace(/[?.!,]+$/, '').trim() : null; },
      exec: function (q) {
        return tfetch('https://universities.hipolabs.com/search?country=' + encodeURIComponent(q) + '&limit=5')
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (!d.length) return 'No universities found for: ' + q;
            return d.map(function (u, i) {
              return (i + 1) + '. **' + u.name + '**' +
                (u.country ? ' \u2014 ' + u.country : '') +
                (u['state-province'] ? ', ' + u['state-province'] : '') +
                (u.web_pages && u.web_pages[0] ? ' | [Visit](' + u.web_pages[0] + ')' : '');
            }).join('\n');
          })
          .catch(function () { return 'Could not fetch universities.'; });
      }
    },

    /* ── FINANCE ───────────────────────────────────── */

    {
      id: 'crypto', name: 'Crypto', icon: '\uD83D\uDCB0',
      match: function (t) {
        var known = [
          'bitcoin','btc','ethereum','eth','solana','sol','dogecoin','doge','xrp','ripple',
          'cardano','ada','polygon','matic','polkadot','dot','avalanche','avax','chainlink','link',
          'uniswap','uni','shiba','shib','shiba inu','tron','trx','ton','pepe','wif','dogwifhat',
          'near','aptos','apt','arbitrum','arb','optimism','op','sui','sei','injective','inj',
          'fantom','ftm','cosmos','atom','render','render token','rune','thorchain','stellar','xlm',
          'litecoin','ltc','bitcoin cash','bch','filecoin','fil','vechain','vet',
          'hedera','hbar','algorand','algo','tezos','xtz','aave','maker','mkr','compound','comp'
        ];
        var low = t.toLowerCase();
        for (var i = 0; i < known.length; i++) {
          if (low === known[i] || low.indexOf(known[i] + ' ') !== -1 || low.indexOf(' ' + known[i]) !== -1) return known[i];
        }
        if (/(?:crypto|coin|token)\s+(?:price|of|value|worth|cost|rate)/i.test(t)) {
          var m = t.match(/(?:crypto|coin|token)\s+(?:price|of|value|worth|cost|rate)\s+(?:of\s+|for\s+)?(\w+)/i);
          return m ? m[1] : null;
        }
        return null;
      },
      exec: function (q) {
        return tfetch('https://api.coingecko.com/api/v3/search?query=' + encodeURIComponent(q))
          .then(sj)
          .then(function (d) {
            if (!d.coins || !d.coins.length) return 'Crypto not found: ' + q;
            var c = d.coins[0];
            var out = '**' + c.name + '** (' + c.symbol.toUpperCase() + ')' +
              '\nMarket Cap Rank: #' + (c.market_cap_rank || 'N/A');
            if (c.price_btc) out += '\nPrice in BTC: ' + c.price_btc.toFixed(8) + ' BTC';
            if (c.market_cap) out += '\nMarket Cap: $' + (c.market_cap > 1e9 ? (c.market_cap / 1e9).toFixed(2) + 'B' : (c.market_cap / 1e6).toFixed(2) + 'M');
            if (c.score) out += '\nTrust Score: ' + c.score + '/5';
            return out;
          })
          .catch(function () { return 'Could not fetch crypto data for: ' + q; });
      }
    },

    {
      id: 'exchange', name: 'Exchange', icon: '\uD83D\uDCB1',
      match: function (t) {
        var m = t.match(/(\d+\.?\d*)\s*([A-Za-z]{3})\s*(?:to|in|into|=|to\s+equal)\s*([A-Za-z]{3})/);
        if (m) return m[0].trim();
        var m2 = t.match(/(?:exchange\s*rate|convert|currency)\s+(.+)/i);
        if (m2) return m2[1].replace(/[?.!,]+$/, '').trim();
        var m3 = t.match(/(?:how\s+much\s+is)\s*(\d+\.?\d*)\s*([A-Za-z]{3})\s*(?:in|to)\s*([A-Za-z]{3})/i);
        if (m3) return m3[0].trim();
        return null;
      },
      exec: function (q) {
        return tfetch('https://open.er-api.com/v6/latest/USD')
          .then(sj)
          .then(function (d) {
            var rates = d.rates;
            var m = q.match(/(\d+\.?\d*)\s*([A-Za-z]{3})\s*(?:to|in|into|=|to\s+equal)\s*([A-Za-z]{3})/i);
            if (m) {
              var amount = parseFloat(m[1]), from = m[2].toUpperCase(), to = m[3].toUpperCase();
              if (rates[from] && rates[to]) {
                var result = amount * (rates[to] / rates[from]);
                var rate = rates[to] / rates[from];
                return '**' + amount.toLocaleString() + ' ' + from + '** = **' + result.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + to + '**' +
                  '\nRate: 1 ' + from + ' = ' + rate.toFixed(4) + ' ' + to +
                  '\nInverse: 1 ' + to + ' = ' + (1 / rate).toFixed(4) + ' ' + from;
              }
              return 'Currency not supported: ' + from + ' or ' + to;
            }
            var w = q.toUpperCase().split(/\s+/), f = [];
            w.forEach(function (c) { if (rates[c]) f.push(c + ': ' + rates[c].toFixed(4) + ' USD'); });
            return f.length ? '**Exchange Rates (per 1 USD):**\n' + f.join('\n') : 'No matching currencies in: ' + q;
          })
          .catch(function () { return 'Could not fetch exchange rates.'; });
      }
    },

    /* ── KNOWLEDGE ─────────────────────────────────── */

    {
      id: 'wiki', name: 'Wikipedia', icon: '\uD83D\uDD0D',
      match: function (t) {
        var m = t.match(/(?:wikipedia|wiki(?:pedia)?)\s+(?:about\s+|on\s+|for\s+)?(.+)/i);
        if (m) return m[1].replace(/[?.!,]+$/, '').trim().replace(/^(the|a|an)\s+/i, '');
        var m2 = t.match(/(?:who (?:is|was|are|were)|what (?:is|was|are|were))\s+(.+?)[?.!,\s]*$/i);
        if (m2 && !isCountry(m2[1])) return m2[1].replace(/[?.!,]+$/, '').trim().replace(/^(the|a|an)\s+/i, '');
        var m3 = t.match(/(?:history (?:of|about)|explain|describe|tell me (?:about|more about)|learn about|know about|look up|search)\s+(.+?)[?.!,\s]*$/i);
        if (m3 && !isCountry(m3[1])) return m3[1].replace(/[?.!,]+$/, '').trim().replace(/^(the|a|an)\s+/i, '');
        return null;
      },
      exec: function (q) {
        return tfetch('https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q))
          .then(sj)
          .then(function (d) {
            if (d.type === 'disambiguation') return '**' + (d.title || q) + '** is ambiguous. Could refer to multiple topics. Please be more specific.';
            var out = (d.title ? '**' + d.title + '**' : '') + (d.description ? ' \u2014 ' + d.description : '');
            if (d.extract) out += '\n\n' + d.extract;
            if (d.content_urls && d.content_urls.desktop) out += '\n\n[Read more](' + d.content_urls.desktop.page + ')';
            return out;
          })
          .catch(function () { return 'Could not fetch Wikipedia for: ' + q; });
      }
    },

    {
      id: 'dict', name: 'Dictionary', icon: '\uD83D\uDCD6',
      match: function (t) {
        var m = t.match(/(?:define|definition|meaning (?:of|for)|what does ["']?(\w+)["']?\s+mean)\s*(?:"?\s*([^"']+)\s*"?)?/i);
        if (m) return (m[2] || m[1] || '').replace(/[?.!,]+$/, '').trim() || null;
        var m2 = t.match(/(?:define|definition)\s+(.+)/i);
        return m2 ? m2[1].replace(/[?.!,]+$/, '').trim() : null;
      },
      exec: function (q) {
        return tfetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (d) {
            if (d.title) return 'Definition not found for: ' + q;
            var e = d[0], out = '**' + e.word + '**' + (e.phonetic ? '  ' + e.phonetic : '');
            if (e.phonetics) e.phonetics.forEach(function (p) { if (p.audio) out += ' [\uD83D\uDD0A](' + p.audio + ')'; });
            e.meanings.forEach(function (m) {
              out += '\n\n**' + m.partOfSpeech + '**';
              m.definitions.slice(0, 3).forEach(function (d, i) {
                out += '\n' + (i + 1) + '. ' + d.definition;
                if (d.example) out += '\n   Example: "' + d.example + '"';
              });
              if (m.synonyms && m.synonyms.length) out += '\n   Synonyms: ' + m.synonyms.slice(0, 5).join(', ');
              if (m.antonyms && m.antonyms.length) out += '\n   Antonyms: ' + m.antonyms.slice(0, 5).join(', ');
            });
            return out;
          })
          .catch(function () { return 'Could not fetch definition for: ' + q; });
      }
    },

    {
      id: 'trivia', name: 'Trivia', icon: '\u2753',
      match: function (t) { return /(?:trivia|quiz\s*question|test\s*me|random\s*question|quiz\s*me)/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://opentdb.com/api.php?amount=1&type=multiple')
          .then(sj)
          .then(function (d) {
            if (!d.results || !d.results.length) return 'Could not fetch trivia.';
            var q = d.results[0];
            var qt = q.question.replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
            var a = [q.correct_answer].concat(q.incorrect_answers || []).filter(function (x) { return x != null && x !== ''; });
            a = shuffle(a);
            return '**' + q.category + '** (' + q.difficulty + ')\n\n' + qt + '\n\n' +
              a.map(function (x, i) { return String.fromCharCode(65 + i) + ') ' + x; }).join('\n') +
              '\n\n||Answer: **' + q.correct_answer + '**||';
          })
          .catch(function () { return 'Could not fetch trivia.'; });
      }
    },

    /* ── ENTERTAINMENT ─────────────────────────────── */

    {
      id: 'joke', name: 'Joke', icon: '\uD83D\uDE04',
      match: function (t) { return /(?:tell|say|give|have|know)\s*(?:me\s+)?(?:a\s+)?(?:joke|something funny|make me laugh|funny)/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://official-joke-api.appspot.com/random_joke')
          .then(sj)
          .then(function (d) { return d.setup + ' ... ' + d.punchline; })
          .catch(function () { return 'Could not fetch joke.'; });
      }
    },

    {
      id: 'chuck', name: 'Chuck Norris', icon: '\uD83D\uDCAA',
      match: function (t) { return /chuck\s*norris/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://api.chucknorris.io/jokes/random')
          .then(sj)
          .then(function (d) { return d.value; })
          .catch(function () { return 'Could not fetch Chuck Norris fact.'; });
      }
    },

    {
      id: 'quote', name: 'Quote', icon: '\uD83D\uDCAC',
      match: function (t) { return /(?:quote|motivat|inspirat|wisdom|saying|famous\s*quote)/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://api.quotable.io/random')
          .then(sj)
          .then(function (d) { return '**"' + d.content + '"**\n\u2014 ' + d.author + (d.tags && d.tags.length ? '  (' + d.tags.join(', ') + ')' : ''); })
          .catch(function () {
            return tfetch('https://dummyjson.com/quotes/random')
              .then(sj)
              .then(function (d) { return '**"' + d.quote + '"**\n\u2014 ' + d.author; })
              .catch(function () { return 'Could not fetch quote.'; });
          });
      }
    },

    {
      id: 'cat', name: 'Cat Fact', icon: '\uD83D\uDC31',
      match: function (t) { return /cat\s*fact|fact\s*(?:about|on)\s*cat|tell.*cat/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://catfact.ninja/fact')
          .then(sj)
          .then(function (d) { return d.fact; })
          .catch(function () { return 'Could not fetch cat fact.'; });
      }
    },

    {
      id: 'dog', name: 'Dog Image', icon: '\uD83D\uDC36',
      match: function (t) { return /(?:show|get|random|see|send)\s*(?:me\s+)?(?:a\s+)?(?:dog|puppy|pup)\s*(?:image|pic|photo)?/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://dog.ceo/api/breeds/image/random')
          .then(sj)
          .then(function (d) { return '![Dog](' + d.message + ')'; })
          .catch(function () { return 'Could not fetch dog image.'; });
      }
    },

    {
      id: 'pokemon', name: 'Pok\u00E9dex', icon: '\uD83E\uDDFE',
      match: function (t) { var m = t.match(/(?:pokemon|pok[e\u00E9]dex|pok[e\u00E9]mon)\s+(?:info\s+)?(?:about\s+)?(?:#?)(\w+)/i); return m ? m[1].replace(/[?.!,]+$/, '').trim() : null; },
      exec: function (q) {
        return tfetch('https://pokeapi.co/api/v2/pokemon/' + encodeURIComponent(q.toLowerCase()))
          .then(sj)
          .then(function (d) {
            return '**' + d.name.toUpperCase() + '** #' + d.id +
              '\nType: ' + d.types.map(function (t) { return t.type.name.toUpperCase(); }).join(' / ') +
              '\nHeight: ' + (d.height / 10) + 'm | Weight: ' + (d.weight / 10) + 'kg' +
              '\nAbilities: ' + d.abilities.map(function (a) { return a.ability.name; }).join(', ') +
              '\nStats: HP:' + d.stats[0].base_stat + ' ATK:' + d.stats[1].base_stat + ' DEF:' + d.stats[2].base_stat + ' SP.ATK:' + d.stats[3].base_stat + ' SP.DEF:' + d.stats[4].base_stat + ' SPD:' + d.stats[5].base_stat +
              '\n[Sprite](' + d.sprites.front_default + ')';
          })
          .catch(function () { return 'Pok\u00E9mon not found: ' + q; });
      }
    },

    {
      id: 'bored', name: 'Activity', icon: '\uD83C\uDFAE',
      match: function (t) { return /(?:bored|nothing to do|what should i do|suggest.*activity|give me.*to do|i'm bored)/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://bored-api.appbrewery.com/random')
          .then(sj)
          .then(function (d) { return '**' + d.activity + '**\nType: ' + d.type + ' | Participants: ' + d.participants + (d.link ? '\n[Learn more](' + d.link + ')' : ''); })
          .catch(function () { return 'Could not fetch activity.'; });
      }
    },

    {
      id: 'advice', name: 'Advice', icon: '\uD83D\uDCA1',
      match: function (t) { return /(?:give me|need|want|have|i\s+want|i\s+need)?\s*(?:an?)?\s*advice(?:\s+(?:on|about|for))?/i.test(t) && !/(?:joke|quote|fact|trivia)/i.test(t) ? 'r' : null; },
      exec: function () {
        return tfetch('https://api.adviceslip.com/advice')
          .then(sj)
          .then(function (d) { return d.slip ? d.slip.advice : 'No advice available.'; })
          .catch(function () { return 'Could not fetch advice.'; });
      }
    },

    /* ── SOCIAL / PROFILES ─────────────────────────── */

    {
      id: 'github', name: 'GitHub', icon: '\uD83D\uDCBB',
      match: function (t) {
        var m = t.match(/(?:github|gh)(?:\.com)?\s*(?:user|profile|repo|stats?|of|for|about)?\s*@?(\w[\w-]{0,38})/i);
        return m ? m[1] : null;
      },
      exec: function (q) {
        return tfetch('https://api.github.com/users/' + encodeURIComponent(q))
          .then(sj)
          .then(function (d) {
            if (d.message) return 'GitHub user not found: ' + q;
            var out = '**' + d.login + '**' + (d.name ? ' (' + d.name + ')' : '');
            if (d.bio) out += '\n' + d.bio;
            out += '\nRepos: ' + d.public_repos + ' | Gists: ' + d.public_gists;
            out += '\nFollowers: ' + d.followers + ' | Following: ' + d.following;
            if (d.location) out += '\nLocation: ' + d.location;
            if (d.company) out += '\nCompany: ' + d.company;
            if (d.blog) out += '\nWebsite: ' + d.blog;
            out += '\nJoined: ' + (d.created_at ? new Date(d.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long' }) : 'N/A');
            if (d.avatar_url) out += '\n![Avatar](' + d.avatar_url + ')';
            return out;
          })
          .catch(function () { return 'Could not fetch GitHub profile for: ' + q; });
      }
    },

    {
      id: 'meal', name: 'Recipe', icon: '\uD83C\uDF5A',
      match: function (t) { var m = t.match(/(?:recipe|how to (?:make|cook|prepare))\s+(?:for|of|with)?\s*(.+)/i); return m ? m[1].replace(/[?.!,]+$/, '').trim() : null; },
      exec: function (q) {
        return tfetch('https://www.themealdb.com/api/json/v1/1/search.php?s=' + encodeURIComponent(q))
          .then(sj)
          .then(function (d) {
            if (!d.meals || !d.meals.length) return 'No recipe found for: ' + q + '. Try a more specific dish name.';
            var m = d.meals[0], ings = [];
            for (var i = 1; i <= 20; i++) {
              if (m['strIngredient' + i] && m['strIngredient' + i].trim()) {
                ings.push('- ' + m['strIngredient' + i] + ' (' + (m['strMeasure' + i] || '').trim() + ')');
              }
            }
            var out = '**' + m.strMeal + '**';
            if (m.strCategory) out += ' | ' + m.strCategory;
            if (m.strArea) out += ' | ' + m.strArea;
            if (m.strTags) out += '\nTags: ' + m.strTags;
            if (m.strYoutube) out += '\n[Video](' + m.strYoutube + ')';
            if (m.strSource) out += '\n[Source](' + m.strSource + ')';
            out += '\n\n**Ingredients (' + ings.length + '):**\n' + ings.join('\n');
            out += '\n\n**Instructions:**\n' + (m.strInstructions || 'Not available');
            return out;
          })
          .catch(function () { return 'Could not fetch recipe for: ' + q; });
      }
    },

    /* ── UTILITIES ─────────────────────────────────── */

    {
      id: 'math', name: 'Calculate', icon: '\uD83D\uDCCA',
      match: function (t) {
        var m = t.match(/(?:calculate|compute|solve|eval|what(?:'s| is))\s+(.+?)(?:\s*[=?\uFF1F]\s*(.+))?$/i);
        if (m) return { expr: m[1].trim(), extra: m[2] || null };
        var m2 = t.match(/^[\d\s+\-*/().%^]+\s*[=]?\s*$/);
        if (m2 && /\d/.test(t) && /[\+\-\*\/\^%]/.test(t)) return { expr: t.trim(), extra: null };
        return null;
      },
      exec: function (q) {
        try {
          var expr = (typeof q === 'string' ? q : q.expr).replace(/[^0-9+\-*/().%\s^]/g, '');
          var safe = expr.replace(/\^/g, '**');
          var result = Function('"use strict";return (' + safe + ')')();
          if (typeof result !== 'number') return 'Not a number';
          if (!isFinite(result)) return 'Error: result is ' + (result > 0 ? 'infinity' : '-infinity');
          return '**' + expr.trim() + '** = **' + result + '**';
        } catch (e) { return 'Could not calculate: ' + e.message + '. Use format like "calculate 25 * 4 + 10"'; }
      }
    },

    {
      id: 'password', name: 'Password', icon: '\uD83D\uDD11',
      match: function (t) { return /(?:generate|create|make|random)\s*(?:a\s+)?(?:strong\s+|secure\s+)?(?:password|passphrase|secret)/i.test(t) ? 'r' : null; },
      exec: function () {
        var lower = 'abcdefghijkmnopqrstuvwxyz', upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ', nums = '23456789', syms = '!@#$%^&*_-+=?';
        var all = lower + upper + nums + syms;
        var pw = '';
        pw += lower[Math.floor(Math.random() * lower.length)];
        pw += upper[Math.floor(Math.random() * upper.length)];
        pw += nums[Math.floor(Math.random() * nums.length)];
        pw += syms[Math.floor(Math.random() * syms.length)];
        for (var i = 4; i < 18; i++) pw += all[Math.floor(Math.random() * all.length)];
        pw = shuffle(pw.split('')).join('');
        return '**Generated password:** `' + pw + '`\nLength: ' + pw.length + ' characters | Strength: Strong\nContains: lowercase, uppercase, numbers, symbols';
      }
    },

    {
      id: 'date', name: 'Date/Time', icon: '\uD83D\uDCC5',
      match: function (t) { return /(?:current|what(?:'s| is) the)?\s*(?:date|time|day|month|year|weekday|today)/i.test(t) ? new Date().toISOString() : null; },
      exec: function () {
        var dt = new Date();
        return '**' + dt.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) + '**' +
          '\n**' + dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + '**' +
          '\nUnix timestamp: ' + Math.floor(dt.getTime() / 1000) +
          '\nISO: ' + dt.toISOString() +
          '\nDay of year: ' + Math.ceil((dt - new Date(dt.getFullYear(), 0, 1)) / 86400000) +
          '\nWeek number: ' + Math.ceil(((dt - new Date(dt.getFullYear(), 0, 1)) / 86400000 + new Date(dt.getFullYear(), 0, 1).getDay() + 1) / 7);
      }
    },

    {
      id: 'uuid', name: 'UUID', icon: '\uD83D\uDD95',
      match: function (t) { return /(?:generate|create|get|new)\s*(?:a\s+)?(?:uuid|guid|unique\s*id)/i.test(t) ? 'r' : null; },
      exec: function () { return '**' + genUUID() + '**\nVersion 4 UUID, randomly generated.'; }
    },

    {
      id: 'lorem', name: 'Lorem Ipsum', icon: '\uD83D\uDCDD',
      match: function (t) { return /(?:lorem\s*ipsum|placeholder\s*text|dummy\s*text|filler\s*text|sample\s*text)/i.test(t) ? 'r' : null; },
      exec: function () {
        return 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.\n\nExcepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.';
      }
    },

    {
      id: 'num', name: 'Number Fact', icon: '\uD83D\uDD22',
      match: function (t) { var m = t.match(/(?:fact|trivia)\s+(?:about\s+)?(?:the\s+)?number\s+(\d+)/i); return m ? m[1] : null; },
      exec: function (n) {
        return tfetch('https://numbersapi.com/' + n + '?json')
          .then(sj)
          .then(function (d) { return '**' + d.number + '**: ' + d.text + (d.found ? '' : ' (no fact found)'); })
          .catch(function () { return 'Could not fetch fact for number ' + n + '.'; });
      }
    },

    /* ── EXTRA UTILITIES ───────────────────────────── */

    {
      id: 'textstats', name: 'Text Stats', icon: '\uD83D\uDCCA',
      match: function (t) {
        var m = t.match(/(?:word\s*count|character\s*count|text\s*stats?|analyze\s*(?:this\s+)?text|count\s*(?:words?|chars?|characters?|letters?|sentences?|paragraphs?))\s*(?:of|for|in)?\s*(.+)/i);
        return m ? m[1].trim().slice(0, 2000) : null;
      },
      exec: function (text) {
        var words = text.trim().split(/\s+/).filter(function (w) { return w.length > 0; });
        var chars = text.length, charsNoSpace = text.replace(/\s/g, '').length;
        var sentences = text.split(/[.!?]+/).filter(function (s) { return s.trim().length > 0; });
        var paragraphs = text.split(/\n\n+/).filter(function (p) { return p.trim().length > 0; });
        var avgWordLen = words.length ? (words.reduce(function (a, w) { return a + w.length; }, 0) / words.length).toFixed(1) : 0;
        var readTime = Math.max(1, Math.ceil(words.length / 200));
        var uniqueWords = [];
        words.forEach(function (w) { if (uniqueWords.indexOf(w.toLowerCase()) === -1) uniqueWords.push(w.toLowerCase()); });
        return '**Text Analysis:**' +
          '\nWords: ' + words.length +
          '\nCharacters: ' + chars + ' (without spaces: ' + charsNoSpace + ')' +
          '\nSentences: ' + sentences.length +
          '\nParagraphs: ' + paragraphs.length +
          '\nUnique words: ' + uniqueWords.length +
          '\nAverage word length: ' + avgWordLen + ' characters' +
          '\nEstimated read time: ~' + readTime + ' min' +
          '\nSpeaking time: ~' + Math.max(1, Math.ceil(words.length / 130)) + ' min';
      }
    },

    {
      id: 'color', name: 'Random Color', icon: '\uD83C\uDFA8',
      match: function (t) { return /(?:random\s*color|generate\s*color|color\s*generator|give me\s*a\s*color|pick\s*a\s*color)/i.test(t) ? 'r' : null; },
      exec: function () {
        var hex = '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0');
        var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
        var max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2 / 255;
        var s = max === min ? 0 : (l > 0.5 ? (max - min) / (510 - max - min) : (max - min) / (max + min));
        var h = 0;
        if (max !== min) {
          var d = max - min;
          if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
          else if (max === g) h = ((b - r) / d + 2) * 60;
          else h = ((r - g) / d + 4) * 60;
        }
        var rgb = 'rgb(' + r + ', ' + g + ', ' + b + ')';
        var hsl = 'hsl(' + Math.round(h) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)';
        var brightness = (r * 299 + g * 587 + b * 114) / 1000;
        var textColor = brightness > 128 ? '#000' : '#fff';
        return '**' + hex.toUpperCase() + '**\nRGB: ' + rgb + '\nHSL: ' + hsl +
          '\nBrightness: ' + Math.round(brightness) + '/255\nContrast text: ' + textColor;
      }
    },

    {
      id: 'hash', name: 'Hash Generator', icon: '\uD83D\uDD10',
      match: function (t) {
        var m = t.match(/(?:hash|sha|md5)\s+(?:of|for|generate)\s*(.+)/i);
        return m ? m[1].trim().slice(0, 500) : null;
      },
      exec: function (text) {
        return Promise.all([
          crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
          crypto.subtle.digest('SHA-1', new TextEncoder().encode(text)),
          crypto.subtle.digest('SHA-512', new TextEncoder().encode(text))
        ]).then(function (bufs) {
          function hex(buf) { return Array.from(new Uint8Array(buf)).map(function (b) { return b.toString(16).padStart(2, '0'); }).join(''); }
          return '**Hashes for:** "' + text.slice(0, 50) + (text.length > 50 ? '...' : '') + '"' +
            '\n\n**SHA-256:** `' + hex(bufs[0]) + '`' +
            '\n**SHA-1:** `' + hex(bufs[1]) + '`' +
            '\n**SHA-512:** `' + hex(bufs[2]) + '`';
        }).catch(function () { return 'Could not generate hashes — crypto.subtle not available in this context.'; });
      }
    }
  ];

  /* ═══════════════════════════════════════════════════
   *  EXECUTION + FORMATTING
   * ═══════════════════════════════════════════════════ */

  /* Run matched tools in parallel */
  function execTools(matches) {
    return Promise.all(matches.map(function (m) {
      return m.tool.exec(m.query)
        .then(function (data) {
          return { name: m.tool.name, icon: m.tool.icon, data: String(data), error: null };
        })
        .catch(function (e) {
          return { name: m.tool.name, icon: m.tool.icon, data: null, error: e.message || 'Unknown error' };
        });
    }));
  }

  /* Format results for AI system prompt context */
  function fmtCtx(results) {
    if (!results.length) return '';
    var c = '\n\n[TOOL RESULTS \u2014 you MUST use these specific facts and data in your response. Do NOT ignore or paraphrase loosely \u2014 use exact numbers and names]:\n';
    results.forEach(function (r, i) {
      c += '\n' + (i + 1) + '. ' + r.icon + ' **' + r.name + '**: ';
      if (r.error) c += '[ERROR: ' + r.error + ']';
      else c += r.data;
      c += '\n';
    });
    c += '[END TOOL RESULTS]\n';
    c += '[IMPORTANT: If a tool result contains "[CHAIN: ...]", follow that suggestion by using the relevant tool on the specified query. This enables multi-step research.]\n';
    return c;
  }

  /* Handle memory store/recall/forget from route result */
  function handleMem(rr, text) {
    var ctx = '';
    if (rr.memStore) {
      var key = simpleHash(rr.memStore);
      Agent.memory.remember(key, rr.memStore, 'fact');
      ctx = '\n[SYSTEM: Stored to memory: "' + rr.memStore.slice(0, 80) + '". Acknowledge briefly if the user explicitly asked to remember it.]\n';
    }
    if (rr.memForget) {
      Agent.memory.forget(rr.memForget);
      ctx += '\n[SYSTEM: Deleted memory matching "' + rr.memForget + '". Confirm to the user.]\n';
    }
    if (rr.memRecall) {
      var res = Agent.memory.recall(text);
      if (res.length) {
        ctx = '\n[MEMORY RECALL \u2014 the user has shared these facts before. Integrate them naturally into your response]:\n';
        res.slice(0, 5).forEach(function (r) {
          ctx += '- [' + r.cat.toUpperCase() + '] ' + r.key + ': ' + r.value + '\n';
        });
        ctx += '[END RECALL]\n';
      } else {
        ctx = '\n[MEMORY: No matching memories found for this query.]\n';
      }
    }
    return ctx;
  }

  /* ── Register everything on Agent ────────────────── */
  Agent.registerTools(T);
  Agent.execTools = execTools;
  Agent.toolCtx = fmtCtx;
  Agent.handleMem = handleMem;
})();
