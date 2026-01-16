// Character definitions for Betrayal at House on the Hill (2nd Edition).
// Includes bio info and full trait tracks (Speed, Might, Sanity, Knowledge).
//
// Notes:
// - `track` is always 8 values (left -> right on the character card).
// - `startIndex` is the 0-based position of the starting clip on the track.
// - Height/weight are stored as strings to match the character card text.
// - EN fields are original; VI fields are Vietnamese translations.

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
 *   en: CharacterProfile;
 *   vi: CharacterProfile;
 * }} CharacterProfileLocalized
 *
 * @typedef {{
 *   track: number[];
 *   startIndex: number;
 * }} TraitTrack
 *
 * @typedef {{
 *   age: number;
 *   height: string;
 *   weight: string;
 *   birthday: string;
 *   hobbies: string[];
 * }} CharacterBio
 *
 * @typedef {{
 *   en: CharacterBio;
 *   vi: CharacterBio;
 * }} CharacterBioLocalized
 *
 * @typedef {{
 *   id: string;
 *   name: { en: string; vi?: string; nickname?: string };
 *   bio: CharacterBioLocalized;
 *   traits: Record<TraitKey, TraitTrack>;
 *   profile?: CharacterProfileLocalized;
 *   color: 'red' | 'blue' | 'green' | 'yellow' | 'white' | 'purple';
 * }} CharacterDef
 */

/** @type {CharacterDef[]} */
export const CHARACTERS = [
    {
        id: 'professor-longfellow',
        name: { en: 'Josiah Longfellow', vi: 'Giáo sư Josiah Longfellow', nickname: 'Professor Longfellow' },
        color: 'white',
        bio: {
            en: {
                age: 57,
                height: '5\'11"',
                weight: '153 lbs.',
                birthday: 'July 27',
                hobbies: ['Gaelic Music', 'Drama', 'Fine Wines'],
            },
            vi: {
                age: 57,
                height: '1m80',
                weight: '69.4 kg',
                birthday: '27 tháng 7',
                hobbies: ['Nhạc Gaelic', 'Kịch nghệ', 'Rượu vang hảo hạng'],
            },
        },
        traits: {
            speed: { track: [2, 2, 4, 4, 5, 5, 6, 6], startIndex: 3 },
            might: { track: [1, 2, 3, 4, 5, 5, 6, 6], startIndex: 2 },
            knowledge: { track: [4, 5, 5, 5, 5, 6, 7, 8], startIndex: 3 },
            sanity: { track: [1, 3, 3, 4, 5, 5, 6, 7], startIndex: 2 },
        },
        profile: {
            en: {
                aliases: ['Professor Longfellow'],
                occupation: 'Professor',
                fear: 'Atychiphobia',
                species: 'Human',
                gender: 'Male',
                info: [
                    'Professor Josiah Longfellow is very proud of his aristocratic roots. His family used to have money... at least until his father lost it all on gambling and alcohol. The professor still lives with his aging mother in the rundown Victorian that used to be the finest house in town. His father disappeared one day. Ran out. His mother has a rather large life insurance policy policy but of course, he doesn\'t want to collect on it anytime soon, no matter how nice the money would be.',
                    'Professor Longfellow knows Ox, Flash and Heather from the university. Brandon is his paper boy, Peter mows the yard and takes care of other petty chores around the house. The Professor\'s greatest fear is that he will lose everything he has, proving to everyone that he\'s no better than his deadbeat father.',
                ].join('\n\n'),
            },
            vi: {
                aliases: ['Giáo sư Longfellow'],
                occupation: 'Giáo sư',
                fear: 'Sợ thất bại',
                species: 'Người',
                gender: 'Nam',
                info: [
                    'Giáo sư Josiah Longfellow rất tự hào về nguồn gốc quý tộc của mình. Gia đình ông từng giàu có... cho đến khi cha ông mất hết vì cờ bạc và rượu chè. Giáo sư vẫn sống với mẹ già trong căn biệt thự Victoria xuống cấp, từng là ngôi nhà đẹp nhất thị trấn. Cha ông biến mất một ngày nọ. Bỏ trốn. Mẹ ông có hợp đồng bảo hiểm nhân thọ khá lớn, nhưng dĩ nhiên ông không muốn nhận tiền sớm, dù số tiền có hấp dẫn đến đâu.',
                    'Giáo sư Longfellow quen biết Ox, Flash và Heather từ trường đại học. Brandon là cậu bé giao báo, còn Peter cắt cỏ và làm việc vặt quanh nhà. Nỗi sợ lớn nhất của Giáo sư là sẽ mất tất cả, chứng minh với mọi người rằng ông chẳng khá hơn người cha vô trách nhiệm của mình.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'heather-granville',
        name: { en: 'Heather Granville', vi: 'Heather Granville' },
        color: 'purple',
        bio: {
            en: {
                age: 18,
                height: '5\'2"',
                weight: '120 lbs.',
                birthday: 'August 2',
                hobbies: ['Television', 'Shopping'],
            },
            vi: {
                age: 18,
                height: '1m57',
                weight: '54.4 kg',
                birthday: '2 tháng 8',
                hobbies: ['Xem TV', 'Mua sắm'],
            },
        },
        traits: {
            speed: { track: [3, 3, 4, 5, 6, 6, 7, 8], startIndex: 2 },
            might: { track: [3, 3, 3, 4, 5, 6, 7, 8], startIndex: 2 },
            knowledge: { track: [2, 3, 3, 4, 5, 6, 7, 8], startIndex: 4 },
            sanity: { track: [3, 3, 3, 4, 5, 6, 6, 6], startIndex: 2 },
        },
        profile: {
            en: {
                relatives: ['Sarah (mother)', 'Caitlyn (older sister)'],
                fear: 'Atelophobia',
                species: 'Human',
                gender: 'Female',
                info: [
                    'Heather has always been perfect—perfectly petite, perfectly blonde, perfectly polite. Perfect, perfect, perfect. If even the teeniest, tiniest thing in her life isn\'t perfect, it gives Heather a headache. Sometimes her headaches get so bad it feels like something is trying to dig its way out of her skull. But even that doesn\'t wipe the perfect smile off of her face.',
                    'Heather\'s older sister is friends with Jenny—why, Heather doesn\'t really know. After all, Jenny\'s certainly NOT perfect. Heather knows Flash and Professor Longfellow from school. Vivian is a friend of her mother\'s, has been for years. Heather\'s greatest fear is that she isn\'t actually perfect after all.',
                ].join('\n\n'),
            },
            vi: {
                relatives: ['Sarah (mẹ)', 'Caitlyn (chị gái)'],
                fear: 'Sợ không hoàn hảo',
                species: 'Người',
                gender: 'Nữ',
                info: [
                    'Heather luôn hoàn hảo — vóc dáng hoàn hảo, tóc vàng hoàn hảo, cử chỉ hoàn hảo. Hoàn hảo, hoàn hảo, hoàn hảo. Nếu có bất kỳ điều gì dù nhỏ nhất trong cuộc sống không hoàn hảo, Heather sẽ bị đau đầu. Đôi khi cơn đau dữ dội đến mức cô cảm giác như có thứ gì đó đang cố đào đường thoát ra khỏi hộp sọ. Nhưng điều đó cũng không xóa được nụ cười hoàn hảo trên gương mặt cô.',
                    'Chị gái Heather là bạn của Jenny — tại sao thì Heather không thực sự hiểu. Xét cho cùng, Jenny chắc chắn KHÔNG hoàn hảo. Heather quen Flash và Giáo sư Longfellow ở trường. Vivian là bạn của mẹ cô từ nhiều năm nay. Nỗi sợ lớn nhất của Heather là cô thực ra không hoàn hảo như mình tưởng.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'father-rhinehardt',
        name: { en: 'Reginald Rhinehardt', vi: 'Cha Reginald Rhinehardt', nickname: 'Father Rhinehardt' },
        color: 'white',
        bio: {
            en: {
                age: 62,
                height: '5\'9"',
                weight: '185 lbs.',
                birthday: 'April 29',
                hobbies: ['Fencing', 'Gardening'],
            },
            vi: {
                age: 62,
                height: '1m75',
                weight: '83.9 kg',
                birthday: '29 tháng 4',
                hobbies: ['Đấu kiếm', 'Làm vườn'],
            },
        },
        traits: {
            speed: { track: [2, 3, 3, 4, 5, 6, 7, 7], startIndex: 2 },
            might: { track: [1, 2, 2, 4, 4, 5, 5, 7], startIndex: 2 },
            knowledge: { track: [1, 3, 3, 4, 5, 6, 6, 8], startIndex: 3 },
            sanity: { track: [3, 4, 5, 5, 6, 7, 7, 8], startIndex: 4 },
        },
        profile: {
            en: {
                aliases: ['Father Rhinehardt'],
                occupation: 'Priest',
                fear: 'Phrenophobia',
                species: 'Human',
                gender: 'Male',
                info: [
                    'Father Rhinehardt was born in München, Germany (or Munich, as Americans call it). He moved with his family to America when he was 15 . . . and then got beaten up for the next three years. Father Rhinehardt turned to religion for the reasons why people treated him so badly. Eventually, he entered Seminary and became a priest. Since that day, long ago, many people have confessed their sins to him. But there is one man who haunts him, every few years, a stranger who sits in the confessional and whispers of murder and madness. In recent years, Father Rhinehardt has found he\'s starting to agree with the madman\'s arguments. Blood, pain, death—they are all a part of life, of God\'s plan, are they not?',
                    'Father Rhinehardt is familiar with Vivian and Madame Zostra from seeing them at the Something Written bookstore. He knows Ox from hearing him confess his petty sins. He also knows Missy from her appearances at Sunday school. More than anything, Father Rhinehardt fears going mad.',
                ].join('\n\n'),
            },
            vi: {
                aliases: ['Cha Rhinehardt'],
                occupation: 'Linh mục',
                fear: 'Sợ phát điên',
                species: 'Người',
                gender: 'Nam',
                info: [
                    'Cha Rhinehardt sinh ra ở München, Đức (hay Munich theo cách gọi của người Mỹ). Ông chuyển đến Mỹ cùng gia đình năm 15 tuổi... rồi bị đánh đập suốt ba năm tiếp theo. Cha Rhinehardt tìm đến tôn giáo để hiểu tại sao người ta đối xử tệ với mình như vậy. Cuối cùng, ông vào Chủng viện và trở thành linh mục. Kể từ ngày đó, nhiều người đã xưng tội với ông. Nhưng có một người ám ảnh ông, cứ vài năm lại xuất hiện, một kẻ lạ ngồi trong tòa giải tội thì thầm về giết chóc và điên loạn. Những năm gần đây, Cha Rhinehardt thấy mình bắt đầu đồng tình với lý lẽ của kẻ điên. Máu, đau đớn, cái chết — tất cả đều là một phần của cuộc sống, của kế hoạch của Chúa, phải không?',
                    'Cha Rhinehardt quen Vivian và Bà Zostra vì hay gặp họ ở hiệu sách Something Written. Ông biết Ox vì nghe anh ta xưng những tội vặt. Ông cũng biết Missy qua các buổi giáo lý ngày Chủ nhật. Hơn bất cứ điều gì, Cha Rhinehardt sợ mình sẽ phát điên.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'jenny-leclerc',
        name: { en: 'Jenny LeClerc', vi: 'Jenny LeClerc' },
        color: 'purple',
        bio: {
            en: {
                age: 21,
                height: '5\'7"',
                weight: '142 lbs.',
                birthday: 'March 4',
                hobbies: ['Reading', 'Soccer'],
            },
            vi: {
                age: 21,
                height: '1m70',
                weight: '64.4 kg',
                birthday: '4 tháng 3',
                hobbies: ['Đọc sách', 'Bóng đá'],
            },
        },
        traits: {
            speed: { track: [2, 3, 4, 4, 4, 5, 6, 8], startIndex: 3 },
            might: { track: [3, 4, 4, 4, 4, 5, 6, 8], startIndex: 2 },
            knowledge: { track: [2, 3, 3, 4, 4, 5, 6, 8], startIndex: 2 },
            sanity: { track: [1, 1, 2, 4, 4, 4, 5, 6], startIndex: 4 },
        },
        profile: {
            en: {
                fear: 'Agoraphobia',
                species: 'Human',
                gender: 'Female',
                info: [
                    'Jenny is a quiet girl. She loves soccer, but sometimes she\'s too shy to cooperate with her teammates the way she should. Jenny\'s greatest pleasure is curling up alone in a tiny place reading a gigantic book—the older the book, the better. The books keep her from dwelling on her mother\'s disappearance, that day fourteen years ago when Mom went to the store and never came back, leaving Jenny alone. Alone forever.',
                    'Jenny\'s only real friend is Caitlyn, Heather\'s older sister. Jenny also knows Ox, since she grew up only a few doors away from him on Mulberry Lane. And Jenny knows Madame Zostra from the library, a place they both adore. Jenny\'s greatest fear is being trapped in a crowd or lost out in the open.',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ đám đông/không gian mở',
                species: 'Người',
                gender: 'Nữ',
                info: [
                    'Jenny là cô gái trầm tính. Cô yêu bóng đá, nhưng đôi khi quá nhút nhát để phối hợp với đồng đội như lẽ ra phải vậy. Niềm vui lớn nhất của Jenny là cuộn tròn một mình trong góc nhỏ đọc những cuốn sách khổng lồ — sách càng cũ càng tốt. Sách giúp cô không nghĩ đến sự biến mất của mẹ, ngày đó mười bốn năm trước khi mẹ đi chợ và không bao giờ trở về, để lại Jenny một mình. Cô đơn mãi mãi.',
                    'Người bạn thực sự duy nhất của Jenny là Caitlyn, chị gái của Heather. Jenny cũng quen Ox vì lớn lên chỉ cách nhà anh vài cánh cửa trên phố Mulberry Lane. Và Jenny quen Bà Zostra ở thư viện, nơi cả hai đều yêu thích. Nỗi sợ lớn nhất của Jenny là bị mắc kẹt trong đám đông hoặc lạc lõng giữa không gian mở.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'darrin-flash-williams',
        name: { en: 'Darrin Williams', vi: 'Darrin "Flash" Williams', nickname: 'Flash' },
        color: 'red',
        bio: {
            en: {
                age: 20,
                height: '5\'11"',
                weight: '188 lbs.',
                birthday: 'June 6',
                hobbies: ['Track', 'Music', 'Shakespearean Literature'],
            },
            vi: {
                age: 20,
                height: '1m80',
                weight: '85.3 kg',
                birthday: '6 tháng 6',
                hobbies: ['Điền kinh', 'Âm nhạc', 'Văn học Shakespeare'],
            },
        },
        traits: {
            speed: { track: [4, 4, 4, 5, 6, 7, 7, 8], startIndex: 4 },
            might: { track: [2, 3, 3, 4, 5, 6, 6, 7], startIndex: 2 },
            knowledge: { track: [2, 3, 3, 4, 5, 5, 5, 7], startIndex: 2 },
            sanity: { track: [1, 2, 3, 4, 5, 5, 5, 7], startIndex: 2 },
        },
        profile: {
            en: {
                fear: 'Diokophobia',
                species: 'Human',
                gender: 'Male',
                info: [
                    'Flash isn\'t the most original name ever for someone as fast as Darrin. But he likes it. It\'s comfortable and it fits him, just like his favorite pair of track shoes. Darrin lives to run and runs to live. When he\'s not running, Darrin feels like there\'s something coming for him...something Not Good. Even when he runs, the wind sometimes whispers in his ears, and he swears he can hear the Not Good Thing coming up behind him—fast. No wonder he\'s the star of the track team.',
                    'Flash knows Jenny from the neighborhood. She\'s okay, but she\'s real quiet. He\'s known Madame Zostra for his entire life. After all, he\'s her nephew. Zoe\'s his little cousin, but he\'s only met her a couple of times. Darrin\'s greatest fear is that he\'s going to be caught by the Not Good Thing (whatever it is).',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ bị đuổi bắt',
                species: 'Người',
                gender: 'Nam',
                info: [
                    'Flash không phải cái tên độc đáo nhất cho ai đó nhanh như Darrin. Nhưng anh thích nó. Nó thoải mái và hợp với anh, giống như đôi giày chạy yêu thích. Darrin sống để chạy và chạy để sống. Khi không chạy, Darrin cảm thấy có thứ gì đó đang đuổi theo mình... thứ gì đó Không Tốt. Ngay cả khi chạy, gió đôi khi thì thầm bên tai, và anh thề có thể nghe thấy Thứ Không Tốt đang đuổi sát phía sau — rất nhanh. Không lạ khi anh là ngôi sao của đội điền kinh.',
                    'Flash quen Jenny từ khu phố. Cô ấy ổn, nhưng rất trầm tính. Anh biết Bà Zostra cả đời vì xét cho cùng, bà là cô của anh. Zoe là em họ nhỏ, nhưng anh chỉ gặp vài lần. Nỗi sợ lớn nhất của Darrin là sẽ bị Thứ Không Tốt bắt được (dù nó là gì).',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'vivian-lopez',
        name: { en: 'Vivian Lopez', vi: 'Vivian Lopez' },
        color: 'blue',
        bio: {
            en: {
                age: 42,
                height: '5\'5"',
                weight: '142 lbs.',
                birthday: 'January 11',
                hobbies: ['Old Movies', 'Horses'],
            },
            vi: {
                age: 42,
                height: '1m65',
                weight: '64.4 kg',
                birthday: '11 tháng 1',
                hobbies: ['Phim cũ', 'Ngựa'],
            },
        },
        traits: {
            speed: { track: [3, 4, 4, 4, 4, 6, 7, 8], startIndex: 3 },
            might: { track: [2, 2, 2, 4, 4, 5, 6, 6], startIndex: 2 },
            knowledge: { track: [4, 5, 5, 5, 5, 6, 6, 7], startIndex: 3 },
            sanity: { track: [4, 4, 4, 5, 6, 7, 8, 8], startIndex: 2 },
        },
        profile: {
            en: {
                fear: 'Pyrophobia',
                species: 'Human',
                gender: 'Female',
                info: [
                    'Vivian\'s perfect day is to get up late, have coffee and doughnuts, and then ride one of her horses all day. Unfortunately, she doesn\'t get to spend too many days like that, since she\'s so busy trying to keep her little used book store from going under. Some days she gets so frustrated she just feels like burning the place down, or maybe just burning down the little shed out back . . . or the school. But she\'d never do anything like that. Still, sometimes she has nightmares about striking the match . . .',
                    'Vivian is a friend of Heather\'s mother, Sarah. She also knows Madame Zostra and Father Rhinehardt as customers at her little book store, Something Written. For extra money, Vivian has been babysitting Missy Dubourde at least once a month for the past few years. Vivian\'s greatest fear is of fire . . . and her fascination with it.',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ lửa',
                species: 'Người',
                gender: 'Nữ',
                info: [
                    'Ngày hoàn hảo của Vivian là dậy muộn, uống cà phê với bánh donut, rồi cưỡi ngựa cả ngày. Đáng tiếc, cô không có nhiều ngày như vậy vì bận rộn giữ cho tiệm sách cũ nhỏ không phá sản. Có những ngày cô bực bội đến mức muốn đốt cả tiệm, hoặc có thể chỉ đốt cái nhà kho phía sau... hoặc trường học. Nhưng cô sẽ không bao giờ làm vậy. Tuy nhiên, đôi khi cô mơ thấy mình đang quẹt que diêm...',
                    'Vivian là bạn của Sarah, mẹ Heather. Cô cũng quen Bà Zostra và Cha Rhinehardt vì họ là khách ở tiệm sách Something Written của cô. Để kiếm thêm tiền, Vivian đã trông Missy Dubourde ít nhất mỗi tháng một lần suốt vài năm qua. Nỗi sợ lớn nhất của Vivian là lửa... và sự mê hoặc của nó.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'ox-bellows',
        name: { en: 'Ox Bellows', vi: 'Ox Bellows' },
        color: 'red',
        bio: {
            en: {
                age: 23,
                height: '6\'4"',
                weight: '288 lbs.',
                birthday: 'October 18',
                hobbies: ['Football', 'Shiny Objects'],
            },
            vi: {
                age: 23,
                height: '1m93',
                weight: '130.6 kg',
                birthday: '18 tháng 10',
                hobbies: ['Bóng bầu dục', 'Đồ vật sáng bóng'],
            },
        },
        traits: {
            speed: { track: [2, 2, 2, 3, 4, 5, 5, 6], startIndex: 4 },
            might: { track: [4, 5, 5, 6, 6, 7, 8, 8], startIndex: 2 },
            knowledge: { track: [2, 2, 3, 3, 5, 5, 6, 6], startIndex: 2 },
            sanity: { track: [2, 2, 3, 4, 5, 5, 6, 7], startIndex: 2 },
        },
        profile: {
            en: {
                fear: 'Nyctophobia',
                species: 'Human',
                gender: 'Male',
                info: [
                    'Ox Bellows was always a big kid. Never got beaten up. Always did the beating up . . . but only when he had to do it. (Well, except for that one time.) Ox doesn\'t like to think about that, but the blood and screams creep into his dreams on cold, lonely nights. His greatest fear is of the dark.',
                    'Ox has known Jenny since they were kids growing up on Mulberry Lane. He met Professor Longfellow at Greenwich University. Ox has known Father Rhinehardt all his life. He\'s been confessing his sins to the priest since he was small (except for that one sin he doesn\'t like to talk about).',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ bóng tối',
                species: 'Người',
                gender: 'Nam',
                info: [
                    'Ox Bellows từ nhỏ đã to lớn. Không bao giờ bị đánh. Luôn là người đánh... nhưng chỉ khi phải làm vậy. (À, trừ một lần đó.) Ox không thích nghĩ về chuyện đó, nhưng máu và tiếng la hét vẫn len vào giấc mơ những đêm lạnh lẽo cô đơn. Nỗi sợ lớn nhất của anh là bóng tối.',
                    'Ox quen Jenny từ khi còn nhỏ, lớn lên ở phố Mulberry Lane. Anh gặp Giáo sư Longfellow ở Đại học Greenwich. Ox biết Cha Rhinehardt cả đời. Anh đã xưng tội với vị linh mục từ bé (trừ một tội mà anh không muốn nhắc đến).',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'madame-zostra',
        name: { en: 'Belladina Zostra', vi: 'Bà Belladina Zostra', nickname: 'Madame Zostra' },
        color: 'blue',
        bio: {
            en: {
                age: 37,
                height: '5\'0"',
                weight: '150 lbs.',
                birthday: 'December 10',
                hobbies: ['Astrology', 'Cooking', 'Baseball'],
            },
            vi: {
                age: 37,
                height: '1m52',
                weight: '68.0 kg',
                birthday: '10 tháng 12',
                hobbies: ['Chiêm tinh', 'Nấu ăn', 'Bóng chày'],
            },
        },
        traits: {
            speed: { track: [2, 3, 3, 5, 5, 6, 6, 7], startIndex: 2 },
            might: { track: [2, 3, 3, 4, 5, 5, 5, 6], startIndex: 3 },
            knowledge: { track: [1, 3, 4, 4, 4, 5, 6, 6], startIndex: 3 },
            sanity: { track: [4, 4, 4, 5, 6, 7, 8, 8], startIndex: 2 },
        },
        profile: {
            en: {
                aliases: ['Madame Zostra'],
                relatives: ['Darrin Williams (nephew)'],
                fear: 'Thanatophobia',
                species: 'Human',
                gender: 'Female',
                info: [
                    'Madame Zostra, or "Belladina" (as her mother named her), has been a tarot and tea-leaf reader since college. She started out working part time sitting in the window of an occult bookstore, but now she has her own home astrology business. Although Madame Zostra reads cards for a living, she won\'t ever read her own cards. She is terrified that she\'ll see her own death in the cards, something she can\'t bear to think about.',
                    'Madame Zostra is familiar with Vivian and Father Rhinehardt from seeing them at Vivian\'s bookstore. Flash is her nephew, and she never fails to buy him birthday and Christmas gifts. She sees Jenny regularly at the library. Zoe\'s mother comes to Madame Zostra for tarot readings. Madame Zostra is terrified of death . . . particularly her own.',
                ].join('\n\n'),
            },
            vi: {
                aliases: ['Bà Zostra'],
                relatives: ['Darrin Williams (cháu trai)'],
                fear: 'Sợ cái chết',
                species: 'Người',
                gender: 'Nữ',
                info: [
                    'Bà Zostra, hay "Belladina" (như mẹ bà đặt tên), đã xem bài tarot và lá trà từ thời đại học. Bà bắt đầu làm bán thời gian ngồi bên cửa sổ hiệu sách huyền bí, nhưng giờ đã có công việc chiêm tinh tại nhà. Dù xem bài tarot để kiếm sống, bà không bao giờ xem bài cho chính mình. Bà sợ sẽ thấy cái chết của mình trong lá bài, điều bà không thể chịu đựng được.',
                    'Bà Zostra quen Vivian và Cha Rhinehardt vì hay gặp họ ở hiệu sách của Vivian. Flash là cháu trai của bà, và bà không bao giờ quên mua quà sinh nhật và Giáng sinh cho cậu. Bà thường gặp Jenny ở thư viện. Mẹ của Zoe đến nhờ Bà Zostra xem bài tarot. Bà Zostra sợ cái chết... đặc biệt là cái chết của chính mình.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'peter-akimoto',
        name: { en: 'Peter Akimoto', vi: 'Peter Akimoto' },
        color: 'green',
        bio: {
            en: {
                age: 13,
                height: '4\'11"',
                weight: '98 lbs.',
                birthday: 'September 3',
                hobbies: ['Bugs', 'Basketball'],
            },
            vi: {
                age: 13,
                height: '1m50',
                weight: '44.5 kg',
                birthday: '3 tháng 9',
                hobbies: ['Côn trùng', 'Bóng rổ'],
            },
        },
        traits: {
            speed: { track: [3, 3, 3, 4, 6, 6, 7, 7], startIndex: 3 },
            might: { track: [2, 3, 3, 4, 5, 5, 6, 8], startIndex: 2 },
            knowledge: { track: [3, 4, 4, 5, 6, 6, 7, 8], startIndex: 2 },
            sanity: { track: [3, 4, 4, 4, 5, 6, 6, 7], startIndex: 3 },
        },
        profile: {
            en: {
                fear: 'Cleithrophobia',
                species: 'Human',
                gender: 'Male',
                info: [
                    'Peter\'s two favorite places in the world are the basketball court and under his house. He likes the basketball court because that\'s where he can play his favorite game. He likes being under the house because it\'s a great place to hunt for bugs, plus it\'s a good place to avoid his five older brothers. Sure, all older brothers pick on their younger siblings, but Peter\'s brothers really pick on him. But what\'s a few broken bones among family? Peter loves bugs and wants to be an entomologist when he grows up—an entomologist who never has to speak to his brothers.',
                    'Peter earns extra money taking care of Professor Longfellow\'s yard (and finding cool bugs – bonus!). He knows Missy from school. She likes to do pretend medical exams on him and check out his real broken bones, but she doesn\'t like it when he shows her his bug collection. Peter\'s greatest fear is that he\'ll get trapped somewhere and never be able to escape.',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ bị nhốt',
                species: 'Người',
                gender: 'Nam',
                info: [
                    'Hai nơi yêu thích nhất của Peter là sân bóng rổ và gầm nhà. Cậu thích sân bóng rổ vì đó là nơi chơi môn thể thao yêu thích. Cậu thích gầm nhà vì là chỗ tuyệt vời để săn côn trùng, và cũng là nơi tốt để tránh năm người anh trai. Tất nhiên, anh trai nào cũng trêu chọc em, nhưng các anh của Peter thực sự hành cậu. Nhưng vài cái xương gãy trong gia đình thì có gì đâu? Peter yêu côn trùng và muốn trở thành nhà côn trùng học khi lớn lên — một nhà côn trùng học không bao giờ phải nói chuyện với các anh.',
                    'Peter kiếm thêm tiền bằng việc chăm sóc vườn của Giáo sư Longfellow (và tìm được côn trùng hay — bonus!). Cậu quen Missy ở trường. Cô bé thích giả vờ khám bệnh cho cậu và xem những xương gãy thật, nhưng không thích khi cậu cho xem bộ sưu tập côn trùng. Nỗi sợ lớn nhất của Peter là sẽ bị mắc kẹt ở đâu đó và không bao giờ thoát ra được.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'missy-dubourde',
        name: { en: 'Missy Dubourde', vi: 'Missy Dubourde' },
        color: 'yellow',
        bio: {
            en: {
                age: 9,
                height: '4\'2"',
                weight: '62 lbs.',
                birthday: 'February 14',
                hobbies: ['Swimming', 'Medicine'],
            },
            vi: {
                age: 9,
                height: '1m27',
                weight: '28.1 kg',
                birthday: '14 tháng 2',
                hobbies: ['Bơi lội', 'Y học'],
            },
        },
        traits: {
            speed: { track: [3, 4, 5, 6, 6, 6, 7, 7], startIndex: 2 },
            might: { track: [2, 3, 3, 3, 4, 5, 6, 7], startIndex: 3 },
            knowledge: { track: [2, 3, 4, 4, 5, 6, 6, 6], startIndex: 3 },
            sanity: { track: [1, 2, 3, 4, 5, 5, 6, 7], startIndex: 2 },
        },
        profile: {
            en: {
                fear: 'Necrophobia',
                species: 'Human',
                gender: 'Female',
                info: [
                    'Missy can\'t remember wanting to be anything except for a doctor. Her favorite gift ever in the whole wide world was her first doctor\'s kit. She practices "medicine" on anyone who will let her. She even cuts up dead frogs and stuff she finds in her yard. But sometimes that gets bad, and she dreams of dead frogs hip-hopping into her bed at night and smothering her. Then she screams.',
                    'Missy knows Peter (and his gross bug collection) from school. She knows Father Rhinehardt from Sunday school (he talks funny and smells like chocolate). Missy lives in the same neighborhood as Brandon. He delivers her family\'s paper, but she doesn\'t really know him. (She thinks he\'s cute, though.) Missy\'s greatest fear is of dead things coming back to life and hunting her.',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ xác chết',
                species: 'Người',
                gender: 'Nữ',
                info: [
                    'Missy không nhớ từng muốn làm gì khác ngoài bác sĩ. Món quà yêu thích nhất trong đời là bộ đồ chơi bác sĩ đầu tiên. Cô bé "khám bệnh" cho bất kỳ ai chịu. Cô thậm chí mổ ếch chết và những thứ tìm được trong sân. Nhưng đôi khi điều đó trở nên tệ hại, và cô mơ thấy ếch chết nhảy lên giường ban đêm và đè nghẹt cô. Rồi cô hét lên.',
                    'Missy quen Peter (và bộ sưu tập côn trùng kinh tởm của cậu) ở trường. Cô biết Cha Rhinehardt từ lớp giáo lý ngày Chủ nhật (ông nói chuyện buồn cười và có mùi sô-cô-la). Missy sống cùng khu với Brandon. Cậu giao báo cho gia đình cô, nhưng cô không thực sự quen cậu. (Tuy nhiên cô nghĩ cậu dễ thương.) Nỗi sợ lớn nhất của Missy là xác chết sống lại và săn đuổi cô.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'brandon-jaspers',
        name: { en: 'Brandon Jaspers', vi: 'Brandon Jaspers' },
        color: 'green',
        bio: {
            en: {
                age: 12,
                height: '5\'1"',
                weight: '109 lbs.',
                birthday: 'May 21',
                hobbies: ['Computers', 'Camping', 'Hockey'],
            },
            vi: {
                age: 12,
                height: '1m55',
                weight: '49.4 kg',
                birthday: '21 tháng 5',
                hobbies: ['Máy tính', 'Cắm trại', 'Khúc côn cầu'],
            },
        },
        traits: {
            speed: { track: [3, 4, 4, 4, 5, 6, 7, 8], startIndex: 3 },
            might: { track: [2, 3, 3, 4, 5, 6, 6, 7], startIndex: 3 },
            knowledge: { track: [1, 3, 3, 5, 5, 6, 6, 7], startIndex: 2 },
            sanity: { track: [3, 3, 3, 4, 5, 6, 7, 8], startIndex: 3 },
        },
        profile: {
            en: {
                fear: 'Pupaphobia',
                species: 'Human',
                gender: 'Male',
                info: [
                    'Brandon loves computers and camping. He takes his new laptop with him wherever he goes. That way he can program AND camp at the same time. Cool. Brandon\'s never liked playing with regular toys, action figures, or that kind of thing. In fact, he hates puppets. He had a clown puppet when he was little, and some mornings when he woke up, he\'d find it had moved closer to him. Once it even had a kitchen knife in its hand. Brandon\'s pretty sure his big brother, Chris, was messing with him. But he still hates puppets.',
                    'Brandon sometimes sees Zoe\'s family when they go camping. Zoe usually hides in the tent with her dolls, though. Yuck. Brandon delivers the newspaper to Professor Longfellow (in his big old freaky house) and to Missy\'s family. Brandon\'s greatest fear is of puppets, particularly clown puppets.',
                ].join('\n\n'),
            },
            vi: {
                fear: 'Sợ con rối',
                species: 'Người',
                gender: 'Nam',
                info: [
                    'Brandon yêu máy tính và cắm trại. Cậu mang laptop mới đi khắp nơi. Như vậy có thể vừa lập trình vừa cắm trại. Tuyệt. Brandon chưa bao giờ thích chơi đồ chơi thông thường, mô hình hay những thứ tương tự. Thực ra, cậu ghét con rối. Cậu có con rối hề hồi nhỏ, và vài buổi sáng thức dậy, cậu thấy nó đã di chuyển lại gần mình. Một lần nó còn cầm dao nhà bếp. Brandon khá chắc anh trai Chris đang trêu cậu. Nhưng cậu vẫn ghét con rối.',
                    'Brandon thỉnh thoảng gặp gia đình Zoe khi đi cắm trại. Tuy nhiên Zoe thường trốn trong lều với búp bê. Ghê. Brandon giao báo cho Giáo sư Longfellow (trong căn nhà cũ kỳ quái) và gia đình Missy. Nỗi sợ lớn nhất của Brandon là con rối, đặc biệt là con rối hề.',
                ].join('\n\n'),
            },
        },
    },
    {
        id: 'zoe-ingstrom',
        name: { en: 'Zoe Ingstrom', vi: 'Zoe Ingstrom' },
        color: 'yellow',
        bio: {
            en: {
                age: 8,
                height: '3\'9"',
                weight: '49 lbs.',
                birthday: 'November 5',
                hobbies: ['Dolls', 'Music'],
            },
            vi: {
                age: 8,
                height: '1m14',
                weight: '22.2 kg',
                birthday: '5 tháng 11',
                hobbies: ['Búp bê', 'Âm nhạc'],
            },
        },
        traits: {
            speed: { track: [4, 4, 4, 4, 5, 6, 8, 8], startIndex: 3 },
            might: { track: [2, 2, 3, 3, 4, 4, 6, 7], startIndex: 3 },
            knowledge: { track: [1, 2, 3, 4, 4, 5, 5, 5], startIndex: 2 },
            sanity: { track: [3, 4, 5, 5, 6, 6, 7, 8], startIndex: 2 },
        },
        profile: {
            en: {
                relatives: ['Darrin Williams (cousin)'],
                fear: 'Bogyphobia',
                species: 'Human',
                gender: 'Female',
                info: [
                    'Zoe likes to play in her room with her dolls. Each doll has its own name, family, history, pets, and everything else a doll needs to be happy. Zoe helps her dolls play out little dramas, mostly happy ones, but sometimes the dolls get mad at each other and hit. Not that Daddies would ever hit Mommies. That doesn\'t happen. Leastways, you\'re not supposed to talk about it when it does. So, Zoe plays with her dolls.',
                    'Flash is Zoe\'s cousin, but she doesn\'t know him real well. Zoe\'s mom goes to Madame Zostra for tarot card readings. Zoe likes playing with her dolls under the table there. Zoe\'s family sometimes goes camping with Brandon\'s family. But Zoe doesn\'t like it, so she mostly stays in the tent and plays with her dolls. Zoe\'s greatest fear is of the boogeyman . . . whoever he is.',
                ].join('\n\n'),
            },
            vi: {
                relatives: ['Darrin Williams (anh họ)'],
                fear: 'Sợ ông kẹ',
                species: 'Người',
                gender: 'Nữ',
                info: [
                    'Zoe thích chơi trong phòng với búp bê. Mỗi con búp bê có tên riêng, gia đình, lịch sử, thú cưng, và mọi thứ búp bê cần để hạnh phúc. Zoe giúp búp bê diễn những vở kịch nhỏ, phần lớn là vui vẻ, nhưng đôi khi búp bê giận nhau và đánh nhau. Không phải Bố bao giờ cũng đánh Mẹ. Điều đó không xảy ra. Ít nhất, không nên nói về nó khi nó xảy ra. Vì vậy, Zoe chơi với búp bê.',
                    'Flash là anh họ của Zoe, nhưng cô bé không quen anh lắm. Mẹ Zoe đến Bà Zostra để xem bài tarot. Zoe thích chơi búp bê dưới gầm bàn ở đó. Gia đình Zoe thỉnh thoảng đi cắm trại với gia đình Brandon. Nhưng Zoe không thích, nên cô bé chủ yếu ở trong lều chơi búp bê. Nỗi sợ lớn nhất của Zoe là ông kẹ... dù ông ta là ai.',
                ].join('\n\n'),
            },
        },
    },
];

/** @type {Record<string, CharacterDef>} */
export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map((c) => [c.id, c]));
