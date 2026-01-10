// Character definitions for Betrayal at House on the Hill (2nd Edition).
// Includes bio info and full trait tracks (Speed, Might, Sanity, Knowledge).
//
// Notes:
// - `track` is always 8 values (left -> right on the character card).
// - `startIndex` is the 0-based position of the starting clip on the track.
// - Height/weight are stored as strings to match the character card text.

export const TRAIT_KEYS = /** @type {const} */ (['speed', 'might', 'sanity', 'knowledge']);

/**
 * @typedef {typeof TRAIT_KEYS[number]} TraitKey
 *
 * @typedef {{
 *   aliases?: string[];
 *   relatives?: string[];
 *   occupation?: string;
 *   fear?: string;
 *   species?: string;
 *   gender?: string;
 *   info?: string;
 * }} CharacterProfile
 *
 * @typedef {{
 *   track: number[];
 *   startIndex: number;
 * }} TraitTrack
 *
 * @typedef {{
 *   id: string;
 *   name: { en: string; nickname?: string };
 *   bio: {
 *     age: number;
 *     height: string;
 *     weight: string;
 *     birthday: string;
 *     hobbies: string[];
 *   };
 *   traits: Record<TraitKey, TraitTrack>;
 *   profile?: CharacterProfile;
 * }} CharacterDef
 */

/** @type {CharacterDef[]} */
export const CHARACTERS = [
    {
        id: 'professor-longfellow',
        name: { en: 'Josiah Longfellow', nickname: 'Professor Longfellow' },
        bio: {
            age: 57,
            height: '5\'11\"',
            weight: '153 lbs.',
            birthday: 'July 27',
            hobbies: ['Gaelic Music', 'Drama', 'Fine Wines'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [2, 2, 4, 4, 5, 5, 6, 6], startIndex: 3 },
            might: { track: [1, 2, 3, 4, 5, 5, 6, 6], startIndex: 2 },
            knowledge: { track: [4, 5, 5, 5, 5, 6, 7, 8], startIndex: 3 },
            sanity: { track: [1, 3, 3, 4, 5, 5, 6, 7], startIndex: 2 },
        },
        profile: {
            aliases: ['Professor Longfellow'],
            occupation: 'Professor',
            fear: 'Atychiphobia',
            species: 'Human',
            gender: 'Male',
            info: [
                'Professor Josiah Longfellow is very proud of his aristocratic roots. His family used to have money... at least until his father lost it all on gambling and alcohol. The professor still lives with his aging mother in the rundown Victorian that used to be the finest house in town. His father disappeared one day. Ran out. His mother has a rather large life insurance policy policy but of course, he doesn’t want to collect on it anytime soon, no matter how nice the money would be.',
                'Professor Longfellow knows Ox, Flash and Heather from the university. Brandon is his paper boy, Peter mows the yard and takes care of other petty chores around the house. The Professor\'s greatest fear is that he will lose everything he has, proving to everyone that he’s no better than his deadbeat father.',
            ].join('\n\n'),
        },
    },
    {
        id: 'heather-granville',
        name: { en: 'Heather Granville' },
        bio: {
            age: 18,
            height: '5\'2\"',
            weight: '120 lbs.',
            birthday: 'August 2',
            hobbies: ['Television', 'Shopping'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [3, 3, 4, 5, 6, 6, 7, 8], startIndex: 2 },
            might: { track: [3, 3, 3, 4, 5, 6, 7, 8], startIndex: 2 },
            knowledge: { track: [2, 3, 3, 4, 5, 6, 7, 8], startIndex: 4 },
            sanity: { track: [3, 3, 3, 4, 5, 6, 6, 6], startIndex: 2 },
        },
        profile: {
            relatives: ['Sarah (mother)', 'Caitlyn (older sister)'],
            fear: 'Atelophobia',
            species: 'Human',
            gender: 'Female',
            info: [
                'Heather has always been perfect—perfectly petite, perfectly blonde, perfectly polite. Perfect, perfect, perfect. If even the teeniest, tiniest thing in her life isn’t perfect, it gives Heather a headache. Sometimes her headaches get so bad it feels like something is trying to dig its way out of her skull. But even that doesn’t wipe the perfect smile off of her face.',
                'Heather’s older sister is friends with Jenny—why, Heather doesn’t really know. After all, Jenny’s certainly NOT perfect. Heather knows Flash and Professor Longfellow from school. Vivian is a friend of her mother’s, has been for years. Heather’s greatest fear is that she isn’t actually perfect after all.',
            ].join('\n\n'),
        },
    },
    {
        id: 'father-rhinehardt',
        name: { en: 'Reginald Rhinehardt', nickname: 'Father Rhinehardt' },
        bio: {
            age: 62,
            height: '5\'9\"',
            weight: '185 lbs.',
            birthday: 'April 29',
            hobbies: ['Fencing', 'Gardening'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [2, 3, 3, 4, 5, 6, 7, 7], startIndex: 2 },
            might: { track: [1, 2, 2, 4, 4, 5, 5, 7], startIndex: 2 },
            knowledge: { track: [1, 3, 3, 4, 5, 6, 6, 8], startIndex: 3 },
            sanity: { track: [3, 4, 5, 5, 6, 7, 7, 8], startIndex: 4 },
        },
        profile: {
            aliases: ['Father Rhinehardt'],
            occupation: 'Priest',
            fear: 'Phrenophobia',
            species: 'Human',
            gender: 'Male',
            info: [
                'Father Rhinehardt was born in München, Germany (or Munich, as Americans call it). He moved with his family to America when he was 15 . . . and then got beaten up for the next three years. Father Rhinehardt turned to religion for the reasons why people treated him so badly. Eventually, he entered Seminary and became a priest. Since that day, long ago, many people have confessed their sins to him. But there is one man who haunts him, every few years, a stranger who sits in the confessional and whispers of murder and madness. In recent years, Father Rhinehardt has found he’s starting to agree with the madman’s arguments. Blood, pain, death—they are all a part of life, of God’s plan, are they not?',
                'Father Rhinehardt is familiar with Vivian and Madame Zostra from seeing them at the Something Written bookstore. He knows Ox from hearing him confess his petty sins. He also knows Missy from her appearances at Sunday school. More than anything, Father Rhinehardt fears going mad.',
            ].join('\n\n'),
        },
    },
    {
        id: 'jenny-leclerc',
        name: { en: 'Jenny LeClerc' },
        bio: {
            age: 21,
            height: '5\'7\"',
            weight: '142 lbs.',
            birthday: 'March 4',
            hobbies: ['Reading', 'Soccer'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [2, 3, 4, 4, 4, 5, 6, 8], startIndex: 3 },
            might: { track: [3, 4, 4, 4, 4, 5, 6, 8], startIndex: 2 },
            knowledge: { track: [2, 3, 3, 4, 4, 5, 6, 8], startIndex: 2 },
            sanity: { track: [1, 1, 2, 4, 4, 4, 5, 6], startIndex: 4 },
        },
        profile: {
            fear: 'Agoraphobia',
            species: 'Human',
            gender: 'Female',
            info: [
                'Jenny is a quiet girl. She loves soccer, but sometimes she’s too shy to cooperate with her teammates the way she should. Jenny’s greatest pleasure is curling up alone in a tiny place reading a gigantic book—the older the book, the better. The books keep her from dwelling on her mother’s disappearance, that day fourteen years ago when Mom went to the store and never came back, leaving Jenny alone. Alone forever.',
                'Jenny’s only real friend is Caitlyn, Heather’s older sister. Jenny also knows Ox, since she grew up only a few doors away from him on Mulberry Lane. And Jenny knows Madame Zostra from the library, a place they both adore. Jenny’s greatest fear is being trapped in a crowd or lost out in the open.',
            ].join('\n\n'),
        },
    },
    {
        id: 'darrin-flash-williams',
        name: { en: 'Darrin Williams', nickname: 'Flash' },
        bio: {
            age: 20,
            height: '5\'11\"',
            weight: '188 lbs.',
            birthday: 'June 6',
            hobbies: ['Track', 'Music', 'Shakespearean Literature'],
        },
        traits: {
            // Matches the provided trait table image:
            // - red value: "Death" threshold
            // - green value: starting clip position
            speed: { track: [4, 4, 4, 5, 6, 7, 7, 8], startIndex: 4 },
            might: { track: [2, 3, 3, 4, 5, 6, 6, 7], startIndex: 2 },
            knowledge: { track: [2, 3, 3, 4, 5, 5, 5, 7], startIndex: 2 },
            sanity: { track: [1, 2, 3, 4, 5, 5, 5, 7], startIndex: 2 },
        },
        profile: {
            fear: 'Diokophobia',
            species: 'Human',
            gender: 'Male',
            info: [
                'Flash isn’t the most original name ever for someone as fast as Darrin. But he likes it. It’s comfortable and it fits him, just like his favorite pair of track shoes. Darrin lives to run and runs to live. When he’s not running, Darrin feels like there’s something coming for him...something Not Good. Even when he runs, the wind sometimes whispers in his ears, and he swears he can hear the Not Good Thing coming up behind him—fast. No wonder he’s the star of the track team.',
                'Flash knows Jenny from the neighborhood. She’s okay, but she’s real quiet. He’s known Madame Zostra for his entire life. After all, he’s her nephew. Zoe’s his little cousin, but he’s only met her a couple of times. Darrin’s greatest fear is that he’s going to be caught by the Not Good Thing (whatever it is).',
            ].join('\n\n'),
        },
    },
    {
        id: 'vivian-lopez',
        name: { en: 'Vivian Lopez' },
        bio: {
            age: 42,
            height: '5\'5\"',
            weight: '142 lbs.',
            birthday: 'January 11',
            hobbies: ['Old Movies', 'Horses'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [3, 4, 4, 4, 4, 6, 7, 8], startIndex: 3 },
            might: { track: [2, 2, 2, 4, 4, 5, 6, 6], startIndex: 2 },
            knowledge: { track: [4, 5, 5, 5, 5, 6, 6, 7], startIndex: 3 },
            sanity: { track: [4, 4, 4, 5, 6, 7, 8, 8], startIndex: 2 },
        },
        profile: {
            fear: 'Pyrophobia',
            species: 'Human',
            gender: 'Female',
            info: [
                'Vivian’s perfect day is to get up late, have coffee and doughnuts, and then ride one of her horses all day. Unfortunately, she doesn’t get to spend too many days like that, since she’s so busy trying to keep her little used book store from going under. Some days she gets so frustrated she just feels like burning the place down, or maybe just burning down the little shed out back . . . or the school. But she’d never do anything like that. Still, sometimes she has nightmares about striking the match . . .',
                'Vivian is a friend of Heather’s mother, Sarah. She also knows Madame Zostra and Father Rhinehardt as customers at her little book store, Something Written. For extra money, Vivian has been babysitting Missy Dubourde at least once a month for the past few years. Vivian’s greatest fear is of fire . . . and her fascination with it.',
            ].join('\n\n'),
        },
    },
    {
        id: 'ox-bellows',
        name: { en: 'Ox Bellows' },
        bio: {
            age: 23,
            height: '6\'4\"',
            weight: '288 lbs.',
            birthday: 'October 18',
            hobbies: ['Football', 'Shiny Objects'],
        },
        traits: {
            speed: { track: [2, 2, 2, 3, 4, 5, 5, 6], startIndex: 4 },
            might: { track: [4, 5, 5, 6, 6, 7, 8, 8], startIndex: 2 },
            knowledge: { track: [2, 2, 3, 3, 5, 5, 6, 6], startIndex: 2 },
            sanity: { track: [2, 2, 3, 4, 5, 5, 6, 7], startIndex: 2 },
        },
        profile: {
            fear: 'Nyctophobia',
            species: 'Human',
            gender: 'Male',
            info: [
                'Ox Bellows was always a big kid. Never got beaten up. Always did the beating up . . . but only when he had to do it. (Well, except for that one time.) Ox doesn’t like to think about that, but the blood and screams creep into his dreams on cold, lonely nights. His greatest fear is of the dark.',
                'Ox has known Jenny since they were kids growing up on Mulberry Lane. He met Professor Longfellow at Greenwich University. Ox has known Father Rhinehardt all his life. He’s been confessing his sins to the priest since he was small (except for that one sin he doesn’t like to talk about).',
            ].join('\n\n'),
        },
    },
    {
        id: 'madame-zostra',
        name: { en: 'Belladina Zostra', nickname: 'Madame Zostra' },
        bio: {
            age: 37,
            height: '5\'0\"',
            weight: '150 lbs.',
            birthday: 'December 10',
            hobbies: ['Astrology', 'Cooking', 'Baseball'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [2, 3, 3, 5, 5, 6, 6, 7], startIndex: 2 },
            might: { track: [2, 3, 3, 4, 5, 5, 5, 6], startIndex: 3 },
            knowledge: { track: [1, 3, 4, 4, 4, 5, 6, 6], startIndex: 3 },
            sanity: { track: [4, 4, 4, 5, 6, 7, 8, 8], startIndex: 2 },
        },
        profile: {
            aliases: ['Madame Zostra'],
            relatives: ['Darrin Williams (nephew)'],
            fear: 'Thanatophobia',
            species: 'Human',
            gender: 'Female',
            info: [
                'Madame Zostra, or “Belladina” (as her mother named her), has been a tarot and tea-leaf reader since college. She started out working part time sitting in the window of an occult bookstore, but now she has her own home astrology business. Although Madame Zostra reads cards for a living, she won’t ever read her own cards. She is terrified that she’ll see her own death in the cards, something she can’t bear to think about.',
                'Madame Zostra is familiar with Vivian and Father Rhinehardt from seeing them at Vivian’s bookstore. Flash is her nephew, and she never fails to buy him birthday and Christmas gifts. She sees Jenny regularly at the library. Zoe’s mother comes to Madame Zostra for tarot readings. Madame Zostra is terrified of death . . . particularly her own.',
            ].join('\n\n'),
        },
    },
    {
        id: 'peter-akimoto',
        name: { en: 'Peter Akimoto' },
        bio: {
            age: 13,
            height: '4\'11\"',
            weight: '98 lbs.',
            birthday: 'September 3',
            hobbies: ['Bugs', 'Basketball'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [3, 3, 3, 4, 6, 6, 7, 7], startIndex: 3 },
            might: { track: [2, 3, 3, 4, 5, 5, 6, 8], startIndex: 2 },
            knowledge: { track: [3, 4, 4, 5, 6, 6, 7, 8], startIndex: 2 },
            sanity: { track: [3, 4, 4, 4, 5, 6, 6, 7], startIndex: 3 },
        },
        profile: {
            fear: 'Cleithrophobia',
            species: 'Human',
            gender: 'Male',
            info: [
                'Peter’s two favorite places in the world are the basketball court and under his house. He likes the basketball court because that’s where he can play his favorite game. He likes being under the house because it’s a great place to hunt for bugs, plus it’s a good place to avoid his five older brothers. Sure, all older brothers pick on their younger siblings, but Peter’s brothers really pick on him. But what’s a few broken bones among family? Peter loves bugs and wants to be an entomologist when he grows up—an entomologist who never has to speak to his brothers.',
                'Peter earns extra money taking care of Professor Longfellow’s yard (and finding cool bugs – bonus!). He knows Missy from school. She likes to do pretend medical exams on him and check out his real broken bones, but she doesn’t like it when he shows her his bug collection. Peter’s greatest fear is that he’ll get trapped somewhere and never be able to escape.',
            ].join('\n\n'),
        },
    },
    {
        id: 'missy-dubourde',
        name: { en: 'Missy Dubourde' },
        bio: {
            age: 9,
            height: '4\'2\"',
            weight: '62 lbs.',
            birthday: 'February 14',
            hobbies: ['Swimming', 'Medicine'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [3, 4, 5, 6, 6, 6, 7, 7], startIndex: 2 },
            might: { track: [2, 3, 3, 3, 4, 5, 6, 7], startIndex: 3 },
            knowledge: { track: [2, 3, 4, 4, 5, 6, 6, 6], startIndex: 3 },
            sanity: { track: [1, 2, 3, 4, 5, 5, 6, 7], startIndex: 2 },
        },
        profile: {
            fear: 'Necrophobia',
            species: 'Human',
            gender: 'Female',
            info: [
                'Missy can’t remember wanting to be anything except for a doctor. Her favorite gift ever in the whole wide world was her first doctor’s kit. She practices “medicine” on anyone who will let her. She even cuts up dead frogs and stuff she finds in her yard. But sometimes that gets bad, and she dreams of dead frogs hip-hopping into her bed at night and smothering her. Then she screams.',
                'Missy knows Peter (and his gross bug collection) from school. She knows Father Rhinehardt from Sunday school (he talks funny and smells like chocolate). Missy lives in the same neighborhood as Brandon. He delivers her family’s paper, but she doesn’t really know him. (She thinks he’s cute, though.) Missy’s greatest fear is of dead things coming back to life and hunting her.',
            ].join('\n\n'),
        },
    },
    {
        id: 'brandon-jaspers',
        name: { en: 'Brandon Jaspers' },
        bio: {
            age: 12,
            height: '5\'1\"',
            weight: '109 lbs.',
            birthday: 'May 21',
            hobbies: ['Computers', 'Camping', 'Hockey'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [3, 4, 4, 4, 5, 6, 7, 8], startIndex: 3 },
            might: { track: [2, 3, 3, 4, 5, 6, 6, 7], startIndex: 3 },
            knowledge: { track: [1, 3, 3, 5, 5, 6, 6, 7], startIndex: 2 },
            sanity: { track: [3, 3, 3, 4, 5, 6, 7, 8], startIndex: 3 },
        },
        profile: {
            fear: 'Pupaphobia',
            species: 'Human',
            gender: 'Male',
            info: [
                'Brandon loves computers and camping. He takes his new laptop with him wherever he goes. That way he can program AND camp at the same time. Cool. Brandon’s never liked playing with regular toys, action figures, or that kind of thing. In fact, he hates puppets. He had a clown puppet when he was little, and some mornings when he woke up, he’d find it had moved closer to him. Once it even had a kitchen knife in its hand. Brandon’s pretty sure his big brother, Chris, was messing with him. But he still hates puppets.',
                'Brandon sometimes sees Zoe’s family when they go camping. Zoe usually hides in the tent with her dolls, though. Yuck. Brandon delivers the newspaper to Professor Longfellow (in his big old freaky house) and to Missy’s family. Brandon’s greatest fear is of puppets, particularly clown puppets.',
            ].join('\n\n'),
        },
    },
    {
        id: 'zoe-ingstrom',
        name: { en: 'Zoe Ingstrom' },
        bio: {
            age: 8,
            height: '3\'9\"',
            weight: '49 lbs.',
            birthday: 'November 5',
            hobbies: ['Dolls', 'Music'],
        },
        traits: {
            // Matches the provided trait table image (green value = starting clip position).
            speed: { track: [4, 4, 4, 4, 5, 6, 8, 8], startIndex: 3 },
            might: { track: [2, 2, 3, 3, 4, 4, 6, 7], startIndex: 3 },
            knowledge: { track: [1, 2, 3, 4, 4, 5, 5, 5], startIndex: 2 },
            sanity: { track: [3, 4, 5, 5, 6, 6, 7, 8], startIndex: 2 },
        },
        profile: {
            relatives: ['Darrin Williams (cousin)'],
            fear: 'Bogyphobia',
            species: 'Human',
            gender: 'Female',
            info: [
                'Zoe likes to play in her room with her dolls. Each doll has its own name, family, history, pets, and everything else a doll needs to be happy. Zoe helps her dolls play out little dramas, mostly happy ones, but sometimes the dolls get mad at each other and hit. Not that Daddies would ever hit Mommies. That doesn’t happen. Leastways, you’re not supposed to talk about it when it does. So, Zoe plays with her dolls.',
                'Flash is Zoe’s cousin, but she doesn’t know him real well. Zoe’s mom goes to Madame Zostra for tarot card readings. Zoe likes playing with her dolls under the table there. Zoe’s family sometimes goes camping with Brandon’s family. But Zoe doesn’t like it, so she mostly stays in the tent and plays with her dolls. Zoe’s greatest fear is of the boogeyman . . . whoever he is.',
            ].join('\n\n'),
        },
    },
];

/** @type {Record<string, CharacterDef>} */
export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));

