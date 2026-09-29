import keyTraditions from "./img/Key1.png";
import keyBeliefs from "./img/Key2.png";
import keySymbolism from "./img/Key3.png";
import keyValues from "./img/Key4.png";
import keyWisdom from "./img/key5.png";

/** Key art per reward, keyed by the JOURNEY_KEYS ids (grandCelebrationData.js). */
export const KEY_IMAGES = {
  traditions: keyTraditions,
  beliefs: keyBeliefs,
  symbolism: keySymbolism,
  values: keyValues,
  wisdom: keyWisdom,
};

/** Key earned by each checkpoint, keyed by its puzzle id. */
export const CHECKPOINT_KEY_IMAGES = {
  village_square: keyTraditions,
  riverside_crossing: keyBeliefs,
  festival_market: keySymbolism,
  celebration_steps: keyValues,
  grand_celebration: keyWisdom,
};
