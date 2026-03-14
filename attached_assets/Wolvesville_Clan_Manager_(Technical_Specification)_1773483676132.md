A minimal, blue-and-white themed administrative dashboard for managing Wolvesville clans via the official API.

---

## Theme & UI Specs
* **Framework:** Bootstrap 5 (CDN), React (If you would like), Boxicon.
* **Palette:** * **Primary:** `#F8FAFC` (Ghost White Background).
    * **Accent:** `#007BFF` (Royal Blue Interactive Elements).
    * **Text:** `#334155` (Slate Gray for readability).
    * **Color Pattern:** (Uploaded)
* **Style:** Flat design, card-based layouts, and a sticky topbar for navigation.
* **Responsive:** Small Mobile, Mobile, Tablet, Laptop and Computer.

---

## Page 1: Login & Bot Authentication
**Endpoint:** `POST https://api.wolvesville.com/items/redeemApiHat`

### Functional Logic:
1.  **Input:** User enters their **Bot Authorization Token**.
2.  **Validation:** The system calls the `redeemApiHat` endpoint.
3.  **Conditionals:**
    * **HTTP 204:** Token is valid. Redirect to **Clan Selection**.
    * **Other Codes:** Display "Invalid Token" alert.
4.  **Storage:** Store the valid token in `sessionStorage` for subsequent API calls.

---

## Page 2: Clan Selection (Main Dashboard)
**Endpoint:** `GET https://api.wolvesville.com/clans/authorized`

### UI Components:
* **Clan Grid:** A set of Bootstrap cards displaying:
    * Clan `tag` and `name`.
    * `memberCount` / 50.
* **Action:** Clicking a card saves the `clanId` and redirects to the **Member Management** page.

---

## Page 3: Clan Member & Quest Management
This is the core functional page, divided into four dynamic sections.

### Section 1: Member List
**Endpoint:** `GET /clans/{clanId}/members`
* **Table Columns:** Username, Level, Flair (`some of member is not exist`), Quest Status (`participateInClanQuests`).
* **Flair Parsing Logic:**
    * Extract numbers associated with `©` (Coins) and `G` (Gems).
    * Identify special emojis: `📙` (Gold), `📘` (Gem), `📕` (Opt-out).

### Section 2: Flair Update Function (The "Deduction" Engine)
Automates the subtraction of currency for quest entries.
* **Condition Check:**
    * If **Coin Mode** (≥ 600©): Subtract 600 from flair string, add `📙`.
    * If **Gem Mode** (≥ 180G): Subtract 180 from flair string, add `📘`.
    * From above, if any member already have 📙 or 📘 or 📕 or 🏆. It'll skip that member and don't add any emoji or subtract anything.
* **Review Flow:**
    * The UI generates a "Pending Changes" list (e.g., `Maddoc: 800© -> 200© 📙`).
    * **Buttons:** `[Apply Changes]` (Calls Update API) or `[Deny]`.
-  If a subtraction results in a value of 0© or 0G, we will retain the 0© (or 0G) to indicate that the person has previously made a donation and join quest.
### Section 3: Quest Participation Sync
Logic-based toggle for the `participateInClanQuests` boolean.
* **Automatic Logic:**
    * If flair contains `📙` OR `📘` OR `🏆` → Set `participateInClanQuests = true`.
    * If flair contains `📕` OR `⚠️` OR neither emoji (OR none OR not exist flair) → Set `participateInClanQuests = false` if it true. (For reduce the wasteful work.)
* **Bulk Action:** "Sync All to Quest" button to update the whole roster based on their flair status.

### Section 4: Ledger & Log
* The start datetime for the default is the lastest `FLAIR_EDITED` in clan log (datetime) and end datetime is now.
* User can edit the reference by change start - end time for make sure no lose or mistake anything .
* By click the " Update Flair " this will run through the ledger with in range of start and end datetime. Collecting a change about `DONATE` and increase into member flair © mean `gold` and G mean `gems`
* If a member has an emoji ⚠️ attached and after this update will have value is greater than 0, the emoji will be removed from their Flair.
* Before the API is call and update the change. This show what is changed? [Username] | [ Old Flair ] → [ New Flair ] And allow user to apply or deny it

---
# Page 3: Quest Fee
**Endpoint:** `GET /clans/{clanId}/quests/history`
Returns the list of all quests this clan has done in the past.

Response example:
```json
[
  {
    "quest": {
      "id": "9f1f8bc0-702f-11ea-94cc-fd78aed7e31d",
      "rewards": [
        {
          "type": "AVATAR_ITEM",
          "amount": 1,
          "avatarItemId": "Jje",
          "displayType": "NORMAL"
        },
        ...
      ],
      "promoImageUrl": "https://cdn.wolvesville.com/promos/stayathome.jpg",
      "promoImagePrimaryColor": "#2f4025",
      "purchasableWithGems": false
    },
    "xp": 15000,
    "xpPerReward": 2500,
    "tier": 6,
    "tierStartTime": "2020-05-12T13:45:30.738Z",
    "participants": [
      {
        "playerId": "e65896dc-02ff-43bc-a589-934ecd2ae171",
        "username": "Maddoc",
        "xp": 18330
      }
    ],
    "tierFinished": true,
    "claimedTime": false,
    "tierEndTime": "2020-05-13T13:45:30.738Z"
  },
  ...
]```
```
### Section 1: Summary & Apply Fee
-  **Table of member:**
	The table of members in `participants` who have less than 3000`xp` from the latest quest reference from `tierEndTime`
-  **Bluk Action:** "Apply Fee" button. This will decrease 200© from all members in the table. 
-  **Commit Action:**
	Before the API is call and update the change. This show what is changed? [Username] | [ Old Flair ] → [ New Flair ] And allow user to apply or deny it
-  If any member has a balance less than 0, add an emoji ⚠️ for attention.
- If any quest is active. This page will say `Warning: The quest is Active, please come back after it's finished. Click here to redirect to Active Quest`
---
# Page 4: Quest Active
**Endpoint: ** `GET /clans/{clanId}/quests/active`

Returns the currently active quest for this clan if available.

Response example:
```json
{
  "quest": {
    "id": "635a2336-584f-4b6c-9c67-066896f57ed3",
    "rewards": [
      {
        "type": "AVATAR_ITEM",
        "amount": 1,
        "avatarItemId": "ibu",
        "displayType": "NORMAL"
      },
      ...
    ],
    "promoImageUrl": "https://cdn.wolvesville.com/promos/hobo.jpg",
    "promoImagePrimaryColor": "#4d777f",
    "purchasableWithGems": false
  },
  "xp": 0,
  "xpPerReward": 2500,
  "tier": 0,
  "tierStartTime": "2022-09-27T08:39:34.192Z",
  "participants": [
    {
      "playerId": "e65896dc-02ff-43bc-a589-934ecd2ae171",
      "username": "Maddoc",
      "xp": 0
    }
  ],
  "tierFinished": false,
  "claimedTime": false,
  "tierEndTime": "2022-09-28T08:39:34.192Z"
}`
```

### What does it show?
Quest id, promoImageUrl, `Gold` or `Gem` quest by `purchasableWithGems`, xp, xpPerReward, tier, tierStartTime - tierEndTime (convert UTC+0 → GMT+7), table of `participants` sorted by Most xp, tierFinished, claimedTime.

### If quest is not active.

Response Example
```json
{
  "code": 404,
  "message": "HTTP 404 Not Found"
}
```


If this happened. You need to show `Spin Loading` and call API to...
**Endpoint:** `GET /clans/{clanId}/quests/available`
Returns all quests that are currently available for purchase for this clan.

Response example:
```json
[
  {
    "id": "a422d000-a0ae-11ea-89cd-bb1052a5b44f",
    "rewards": [
      {
        "type": "AVATAR_ITEM",
        "amount": 1,
        "avatarItemId": "Ctk",
        "displayType": "NORMAL"
      },
      ...
    ],
    "promoImageUrl": "https://cdn.wolvesville.com/promos/forger.jpg",
    "promoImagePrimaryColor": "#928781",
    "purchasableWithGems": true
  },
  ...
]
```

- Presented as a set of 5 cards, the promotional images are in landscape format. Don't show about rewards, Just tell me how many rewards array size/length there are.

**Endpoint:** `GET /clans/{clanId}/quests/votes`
Returns votes for all quests that are currently available for this clan.

Response example
```json
{
    "votes": {
        "5e0c64df-20c4-4974-85e8-4010fc8fe843": [],
        "b75fdfc6-cc02-4787-8591-647c3497924d": [],
        "b28be820-a02c-11ea-82b1-ebd52b7407e1": [
            "27f5aeec-7196-46aa-86cf-603ac74cc91a",
            "3ef47ac9-c51e-4003-a2dd-edc21ebf07b4",
            "d023422b-34de-419f-8cac-e15c448f27bd"
        ],
        "827dd690-a034-11ea-9cda-e7bee607bdde": []
    },
    "shuffleVotes": [
        "3ef47ac9-c51e-4003-a2dd-edc21ebf07b4"
    ]
}
```

- Linked with available quest except shuffle votes
- Each array contain empty or memberId which linked to members.
---

## 🛠 Technical Logic Snippet (Flair Parsing)

```javascript
// Example logic for parsing currency from "100© 180G 📙"
function parseFlair(flairString) {
    const coinMatch = flairString.match(/(\d+)©/);
    const gemMatch = flairString.match(/(\d+)G/);
    
    return {
        coins: coinMatch ? parseInt(coinMatch[1]) : 0,
        gems: gemMatch ? parseInt(gemMatch[1]) : 0,
        hasGoldEmoji: flairString.includes('📙'),
        hasGemEmoji: flairString.includes('📘')
    };
}
```

# Example Document 
`GET /clans/{clanId}/members`
Returns a list of all members in this clan. The fields joinMessage, participateInClanQuests and players with a status other than ACCEPTED are only available for bots that have been added to this clan.

Response example:
```json
[
  {
    "playerId": "e65896dc-02ff-43bc-a589-934ecd2ae171",
    "creationTime": "2020-01-06T11:02:41.236Z",
    "xp": 130,
    "status": "ACCEPTED",
    "isCoLeader": false,
    "username": "Maddoc",
    "level": 156,
    "lastOnline": "2022-09-27T09:08:17.577Z",
    "profileIconId": "5c2504a8-e662-4387-bd96-b1030969eea3",
    "profileIconColor": "#000000",
    "profileIconColorMode": "GRADIENT",
    "profileIconGradientPrimary": "#ffbbed",
    "profileIconGradientAccent": "#008ec2",
    "profileIconGradientDirection": "DIAGONAL",
    "playerStatus": "DEFAULT",
    "flair": "Squid",
    "participateInClanQuests": true
  },
  ...
]
```

PUT `/clans/{clanId}/members/all/participateInQuests`
Changes the participation for all clan members in the next clan quest. Request returns all modified clan members.

Request example:
```json
{
  "participateInQuests": true
}
```

PUT
`/clans/{clanId}/members/{memberId}/participateInQuests`
Changes if the member with the id memberId will participate in the next clan quest. Request returns the modified clan member.

Request example:
```json
{
  "participateInQuests": true
}
```

GET `/clans/{clanId}/ledger`
Returns the clan ledger. type can be one of CREATE_CLAN, DONATE (`this is what we work with`), CLAN_QUEST, CLAN_ICON, CLAN_QUEST_SHUFFLE, CLAN_QUEST_SKIP_WAIT or CLAN_QUEST_CLAIM_TIME.

Response example:
```json
[
  {
    "id": "095bea8b-95a8-4719-9e08-21296fb7bc5d",
    "gold": 1800,
    "gems": 0,
    "playerId": "657fd53f-fc00-4ebd-ae3f-c3bb68a4d87d",
    "playerUsername": "Maddoc",
    "clanQuestId": "20f2bdf3-49ce-48b0-8fd8-16ec8d67826f",
    "type": "CLAN_QUEST",
    "creationTime": "2022-08-22T20:11:57.448Z"
  },
  ...
]
```

GET `/clans/{clanId}/logs`
Returns the most recent clan log entries. action can be one of

BLACKLIST_ADDED
BLACKLIST_REMOVED
JOIN_REQUEST_SENT_BY_CLAN
JOIN_REQUEST_SENT_BY_EXTERNAL_PLAYER: an external player sent a request to join this clan
JOIN_REQUEST_ACCEPTED
JOIN_REQUEST_DECLINED_BY_CLAN: leader / co-leader decline the request
JOIN_REQUEST_DECLINED_BY_EXTERNAL_PLAYER: external player declined an invitation to join
JOIN_REQUEST_WITHDRAWN
LEADER_CHANGED
CO_LEADER_PROMOTED
CO_LEADER_DEMOTED
CO_LEADER_RESIGNED
PLAYER_LEFT
PLAYER_KICKED
PLAYER_JOINED
PLAYER_QUEST_PARTICIPATION_ENABLED
PLAYER_QUEST_PARTICIPATION_DISABLED
FLAIR_EDITED (`this is what we work with`)
Each entry will either have playerId + playerUsername or playerBotId + playerBotOwnerUsername defined depending on who initiated the action.

```
Response example:
```json
[
  {
    "playerBotId": "be439d83-e02d-429f-a13c-c782de5225de",
    "playerBotOwnerUsername": "BOT(Maddoc)",
    "targetPlayerId": "e65896dc-02ff-43bc-a589-934ecd2ae171",
    "targetPlayerUsername": "Maddoc",
    "creationTime": "2022-09-29T09:05:43.475Z",
    "action": "PLAYER_QUEST_PARTICIPATION_ENABLED"
  },
  ...
]
```

PUT /clans/{clanId}/members/{memberId}/flair
Changes the flair from the member with the id memberId. Request returns the modified clan member.

Request example:
```json
{
  "flair": "Squid 🦑"
}
```

# Reminder 
Mostly, server might from old to last. And sometimes it's might not be sorted.

The datetime from server always be UTC+0 but since user are GMT+7 there is need to convert to display.