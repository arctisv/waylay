import * as composerGates from "./backend/composerGates";
import * as folders from "./backend/folders";
import * as historySearch from "./backend/historySearch";
import * as homeSuggestions from "./backend/homeSuggestions";
import * as memory from "./backend/memory";
import * as messageQueue from "./backend/messageQueue";
import * as messages from "./backend/messages";
import * as modelFavorites from "./backend/modelFavorites";
import * as preferences from "./backend/preferences";
import * as profile from "./backend/profile";
import * as threads from "./backend/threads";
import * as userContext from "./backend/userContext";
import * as userMemory from "./backend/userMemory";

/* Every backend function, by module, the way the screens call them:
   `useQuery(api.threads.listForCurrentUser)`. Each entry is the definition
   itself, so arguments and results are typed end to end. */
export const api = {
  composerGates,
  folders,
  historySearch,
  homeSuggestions,
  memory,
  messageQueue,
  messages,
  modelFavorites,
  preferences,
  profile,
  threads,
  userContext,
  userMemory,
};
