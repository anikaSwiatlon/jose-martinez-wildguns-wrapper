// ── Config ─────────────────────────────────────────────────────────────────────
var OFFERS = [
  { offeringType: "wood",  offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
  { offeringType: "brick", offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
  { offeringType: "ore",   offeringAmount: 1000, wantingType: "food", wantingAmount: 1700, count: 3 },
];

var RUNTIME = 12; // offer duration in hours

// ── Token ──────────────────────────────────────────────────────────────────
function getUserToken() {
  var params = new URLSearchParams(window.location.search);
  var token = params.get("userToken");
  if (!token) throw new Error("userToken not found in page URL. Make sure you are on the WildGuns game page.");
  return token;
}

// ── Request builder ────────────────────────────────────────────────────────
function buildUrl(offer, userToken) {
  return "https://s1-pl.wildguns.gameforge.com/ajax_interface.php?" + new URLSearchParams({
    ajax_action:    "newMarketOffer",
    userToken:      userToken,
    offeringType:   offer.offeringType,
    offeringAmount: offer.offeringAmount,
    wantingType:    offer.wantingType,
    wantingAmount:  offer.wantingAmount,
    runtime:        RUNTIME,
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function sendRequests() {
  var userToken;
  try {
    userToken = getUserToken();
  } catch (e) {
    console.error(e.message);
    return;
  }

  // Build flat task list from OFFERS config
  var tasks = [];
  for (var o = 0; o < OFFERS.length; o++) {
    var offer = OFFERS[o];
    for (var i = 0; i < offer.count; i++) {
      tasks.push({ offer: offer, index: i + 1 });
    }
  }

  console.log("Sending " + tasks.length + " total requests... token=" + userToken.slice(0, 6) + "****");

  var promises = [];
  for (var j = 0; j < tasks.length; j++) {
    (function(task) {
      promises.push(
        fetch(buildUrl(task.offer, userToken)).then(async function(res) {
          var text = await res.text();
          console.log(
            "[" + task.offer.offeringType + " " + task.index + "/" + task.offer.count + "]"
            + " " + task.offer.offeringAmount + "->" + task.offer.wantingAmount + " " + task.offer.wantingType
            + " | Status: " + res.status + " | " + text
          );
          return { offer: task.offer, index: task.index, status: res.status, body: text };
        })
      );
    })(tasks[j]);
  }

  var results = await Promise.allSettled(promises);

  var succeeded = 0, failed = 0;
  for (var k = 0; k < results.length; k++) {
    if (results[k].status === "fulfilled") succeeded++;
    else failed++;
  }
  console.log("\nDone. " + succeeded + " succeeded, " + failed + " failed.");
}

sendRequests();
