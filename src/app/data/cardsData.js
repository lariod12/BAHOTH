// cardsData.js

export const ITEMS = [
  {
    id: 'long_vu_thien_than',
    type: 'item',
    name: { vi: 'Lông vũ thiên thần' },
    text: {
      vi:
        'Một chiếc lông vũ tuyệt đẹp.\n' +
        'Khi đổ xúc xắc với chỉ số bất kì, bạn có thể chọn một số từ 0 đến 8 và sử dụng đó làm kết quả đổ xúc xắc.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    useOnRoll: true,
    effect: { setRollResult: { min: 0, max: 8 } },
    consumable: true,
  },

  {
    id: 'hop_nhac_ma_quai',
    type: 'item',
    name: { vi: 'Hộp nhạc ma quái' },
    text: {
      vi:
        'Nó vang lên một giai điệu mê hoặc.\n' +
        'Một lần mỗi lượt, bạn có thể mở hoặc đóng hộp nhạc này.\n' +
        'Khi mở, tất cả người chơi (kể cả người sử dụng) và quái vật cùng phòng có chỉ số Sanity đều phải đổ xúc xắc Sanity được 4+. Nếu thất bại, người đó sẽ bị thôi miên và mất lượt.\n' +
        'Nếu người sử dụng bị thôi miên thì sẽ đánh rơi hộp nhạc. Nếu bị rơi, hộp nhạc vẫn sẽ giữ nguyên tình trạng đóng/mở trước đó.',
    },
    usable: true,
    usePerTurn: 1,
    toggleable: true,
    whenOpen: {
      affectsAllInRoom: true,
      includesUser: true,
      includesMonsters: true,
      rollStat: 'sanity',
      threshold: 4,
      onFail: { effect: 'hypnotize', loseTurn: true },
      onUserFail: { effect: 'dropItem' },
    },
  },

  {
    id: 'hop_lac_ghep',
    type: 'item',
    name: { vi: 'Hộp lắp ghép' },
    text: {
      vi:
        'Phải có cách nào để mở nó.\n' +
        'Một lần mỗi lượt, bạn có thể đổ xúc xắc Knowledge để mở chiếc hộp:\n' +
        '6+  Bạn mở thành công, rút 2 lá Item mới và hủy bỏ lá bài này.\n' +
        '0-5  Bạn không mở được.',
    },
    usable: true,
    usePerTurn: 1,
    rollStat: 'knowledge',
    rollResults: [
      { range: '6+', effect: 'drawItem', amount: 2, discard: true },
      { range: '0-5', effect: 'nothing' },
    ],
  },

  {
    id: 'kim_tiem_an_than',
    type: 'item',
    name: { vi: 'Kim tiêm an thần' },
    text: {
      vi:
        'Một ống xi-lanh chứa Adrenaline.\n' +
        'Trước khi đổ xúc xắc với bất kì chỉ số nào, bạn có thể cộng thêm 4 điểm vào kết quả.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    useBeforeRoll: true,
    effect: { addToResult: 4 },
    consumable: true,
  },

  {
    id: 'ao_giap',
    type: 'item',
    name: { vi: 'Áo giáp' },
    text: {
      vi:
        'Một chiếc áo giáp bằng kim loại từ thời Trung cổ.\n' +
        'Giảm 1 sát thương vật lí bạn gánh chịu.\n' +
        'Item này không thể bị cướp.',
    },
    passive: true,
    damageReduction: { physical: 1 },
    cannotSteal: true,
  },

  {
    id: 'cai_chai',
    type: 'item',
    name: { vi: 'Cái chai' },
    text: {
      vi:
        'Cái chai chứa một thứ rượu màu đen.\n' +
        'Sau khi lời nguyền xuất hiện, bạn có thể đổ 3 viên xúc xắc để uống rượu trong chai:\n' +
        '6  Chọn một căn phòng bất kì và đặt nhân vật của bạn ở đó.\n' +
        '5  Tăng 2 Might và 2 Speed.\n' +
        '4  Tăng 2 Knowledge và 2 Sanity.\n' +
        '3  Tăng 1 Knowledge, giảm 1 Sanity.\n' +
        '2  Mất 2 Knowledge và 2 Sanity.\n' +
        '1  Mất 2 Might và 2 Speed.\n' +
        '0  Mất 2 nấc mỗi chỉ số.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
  },

  {
    id: 'xuc_xac_bong_toi',
    type: 'item',
    name: { vi: 'Xúc xắc bóng tối' },
    text: {
      vi:
        'Bạn có cảm thấy may mắn không?\n' +
        'Một lần mỗi lượt, bạn có thể đổ 3 viên xúc xắc:\n' +
        '6  Dịch chuyển đến một người đồng đội bất kì (không phải kẻ phản bội).\n' +
        '5  Dịch chuyển một người đồng đội ở cùng phòng sang phòng liền kề.\n' +
        '4  Tăng 1 Might hoặc Speed.\n' +
        '3  Dịch chuyển đến phòng liền kề.\n' +
        '2  Tăng 1 Knowledge hoặc Sanity.\n' +
        '1  Rút 1 lá bài Event.\n' +
        '0  Giảm toàn bộ chỉ số của bạn về mức thấp nhất (trên mục đầu lâu) và hủy bỏ lá bài này.',
    },
  },

  {
    id: 'chiec_chuong',
    type: 'item',
    name: { vi: 'Chiếc chuông' },
    text: {
      vi:
        'Một cái chuông được làm từ đồng thau và vang lên những âm thanh kì lạ.\n' +
        'Tăng 1 Sanity ngay bây giờ.\n' +
        'Giảm 1 Sanity nếu bạn làm mất Chiếc chuông.\n' +
        'Một lần mỗi lượt, sau khi lời nguyền xuất hiện, bạn có thể đổ xúc xắc Sanity để sử dụng chuông:\n' +
        '5+  Dịch chuyển bất kì số lượng người chơi chính diện về gần bạn 1 bước.\n' +
        '0-4  Toàn bộ quái vật di chuyển về gần bạn 1 bước.',
    },
    onGain: { effect: 'gainStat', stat: 'sanity', amount: 1 },
    onLose: { effect: 'loseStat', stat: 'sanity', amount: 1 },
    usable: true,
    usePerTurn: 1,
    useAfterHaunt: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '5+', effect: 'moveHeroesTowardsYou', steps: 1 },
      { range: '0-4', effect: 'moveMonstersTowardsYou', steps: 1 },
    ],
  },

  {
    id: 'muoi_amoniac',
    type: 'item',
    name: { vi: 'Muối Amoniac' },
    text: {
      vi:
        'Whewww, phê quáaaaaa!\n' +
        'Nếu bạn hoặc người cùng phòng có chỉ số Knowledge ở dưới mức khởi điểm thì hãy tăng lên bằng mức khởi điểm.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    canTargetAllyInRoom: true,
    effect: 'restoreKnowledgeToStarting',
    consumable: true,
  },

  {
    id: 'hon_da_may_man',
    type: 'item',
    name: { vi: 'Hòn đá may mắn' },
    text: {
      vi:
        'Bạn cảm thấy dường như nó sẽ mang lại may mắn.\n' +
        'Sau khi đổ xúc xắc vì bất cứ lí do gì, bạn có thể sử dụng hòn đá để đổ lại (1 lần) số lượng xúc xắc tuỳ ý.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    useAfterRoll: true,
    effect: 'rerollAnyDice',
    consumable: true,
  },

  {
    id: 'dao_gam_hut_mau',
    type: 'item',
    subtype: 'weapon',
    name: { vi: 'Dao găm hút máu' },
    text: {
      vi:
        'Một thứ vũ khí kinh tởm. Những cái kim và vòi mọc ra từ cán đâm vào mạch máu ở tay bạn.\n' +
        'Bạn có thể đổ nhiều hơn 3 viên xúc xắc (tối đa là 8 viên) khi chiến đấu bằng Might với vũ khí này, nhưng đổi lại bạn phải mất 1 Speed mỗi lần sử dụng.\n' +
        'Bạn không thể sử dụng vũ khí khác cùng lúc với vũ khí này.\n' +
        'Item này không thể trao đổi hay đánh rơi. Nếu nó bị cướp, bạn chịu 2 xúc xắc sát thương vật lí.',
    },
    weapon: true,
    combatBonus: {
      stat: 'might',
      extraDice: 3,
      maxDice: 8,
      cost: { loseStat: { speed: 1 } },
    },
    exclusiveWeapon: true,
    cannotTrade: true,
    cannotDrop: true,
    onStolen: { effect: 'physicalDamage', dice: 2 },
  },

  {
    id: 'gang_tay_cua_ke_moc_tui',
    type: 'item',
    name: { vi: 'Găng tay của kẻ móc túi' },
    text: {
      vi:
        'Ăn trộm là xấu!\n' +
        'Nếu bạn đang ở cùng phòng với một người khác, sử dụng lá bài này để trộm 1 Item mà người đó đang sở hữu.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    requiresTargetInRoom: true,
    effect: 'stealItem',
    consumable: true,
  },

  {
    id: 'cay_riu',
    type: 'item',
    subtype: 'weapon',
    name: { vi: 'Cây rìu' },
    text: {
      vi:
        'Một vũ khí cực kì sắc bén.\n' +
        'Bạn được đổ nhiều hơn 1 viên xúc xắc khi tấn công bằng Might với Cây rìu này.\n' +
        'Bạn không thể sử dụng cùng lúc vũ khí khác khi đang dùng Cây rìu.',
    },
    weapon: true,
    combatBonus: {
      stat: 'might',
      extraDice: 1,
    },
    exclusiveWeapon: true,
  },

  {
    id: 'buc_tuong_ma_am',
    type: 'item',
    name: { vi: 'Bức tượng ma ám' },
    text: {
      vi:
        'Có thể nó đã chọn bạn vì lí do nào đó.\n' +
        'Một lần mỗi lượt, trước khi đổ xúc xắc, bạn có thể chà sát vào bức tượng này để được đổ nhiều hơn 2 viên xúc xắc (tối đa 8 viên). Nhưng bạn phải trả giá bằng việc mất 1 Sanity mỗi lần sử dụng.',
    },
    usable: true,
    usePerTurn: 1,
    useBeforeRoll: true,
    effect: {
      extraDice: 2,
      maxDice: 8,
      cost: { loseStat: { sanity: 1 } },
    },
  },

  {
    id: 'dao_gam_hien_te',
    type: 'item',
    subtype: 'weapon',
    name: { vi: 'Dao găm hiến tế' },
    text: {
      vi:
        'Một con dao găm dính đầy máu và được khắc những kí tự bí ẩn.\n' +
        'Bạn được đổ nhiều hơn 3 viên xúc xắc (tối đa 8 viên) khi chiến đấu bằng Might. Nhưng trước khi sử dụng bạn phải đổ xúc xắc Knowledge.\n' +
        '6+  Không có gì xảy ra cả.\n' +
        '3-5  Chịu 1 sát thương tinh thần.\n' +
        '0-2  Con dao cứa vào tay bạn, chịu 1 sát thương vật lí và bạn không thể dùng vũ khí này.\n' +
        'Bạn không thể dùng vũ khí khác cùng lúc với vũ khí này.',
    },
    weapon: true,
    combatBonus: {
      stat: 'might',
      extraDice: 3,
      maxDice: 8,
    },
    useRequiresRoll: {
      stat: 'knowledge',
      results: [
        { range: '6+', effect: 'nothing' },
        { range: '3-5', effect: 'mentalDamage', amount: 1 },
        { range: '0-2', effect: 'physicalDamage', amount: 1, cannotUse: true },
      ],
    },
    exclusiveWeapon: true,
  },

  {
    id: 'ngon_nen',
    type: 'item',
    name: { vi: 'Ngọn nến' },
    text: {
      vi:
        'Nó khiến tà ma tránh xa. Ít nhất là bạn hi vọng thế.\n' +
        'Nếu bạn rút 1 lá Event và bị yêu cầu đổ xúc xắc, bạn được đổ nhiều hơn 1 viên (tối đa 8 viên).\n' +
        'Nếu bạn có đủ bộ 3 lá bài: Cái chuông, Quyển sách và Ngọn nến; thì bạn được tăng 2 nấc mỗi chỉ số. Nếu bạn làm mất 1 trong 3 lá bài trên thì bạn bị giảm 2 nấc mỗi chỉ số.',
    },
    passive: true,
    eventRollBonus: { extraDice: 1, maxDice: 8 },
    setBonus: {
      requiredItems: ['chiec_chuong', 'quyen_sach', 'ngon_nen'],
      onComplete: { effect: 'gainAllStats', amount: 2 },
      onBreak: { effect: 'loseAllStats', amount: 2 },
    },
  },

  {
    id: 'day_chuyen_ho_menh',
    type: 'item',
    name: { vi: 'Dây chuyền hộ mệnh' },
    text: {
      vi:
        'Một mặt dây chuyền cổ bằng bạc, có đính nhiều viên đá quý và được khắc vài dòng chữ tâm linh.\n' +
        'Tăng 1 nấc ở tất cả chỉ số của bạn.\n' +
        'Mất 3 nấc ở tất cả chỉ số nếu bạn làm mất Dây chuyền hộ mệnh.',
    },
    onGain: { effect: 'gainAllStats', amount: 1 },
    onLose: { effect: 'loseAllStats', amount: 3 },
  },

  {
    id: 'tui_cuu_thuong',
    type: 'item',
    name: { vi: 'Túi cứu thương' },
    text: {
      vi:
        'Túi của bác sĩ, chứa nhiều thứ có thể cứu mạng người.\n' +
        'Một lần mỗi lượt, bạn có thể đổ xúc xắc Knowledge để sử dụng túi cứu thương cho chính mình hoặc đồng đội cùng phòng:\n' +
        '8+  Tăng 3 nấc chỉ số vật lí.\n' +
        '6-7  Tăng 2 nấc chỉ số vật lí.\n' +
        '4-5  Tăng 1 nấc chỉ số vật lí.\n' +
        '0-3  Bạn không đủ trình độ để dùng túi cứu thương.\n' +
        'Lưu ý: bạn không thể tăng chỉ số vượt quá mức khởi điểm.',
    },
    usable: true,
    usePerTurn: 1,
    rollStat: 'knowledge',
    canTargetAllyInRoom: true,
    rollResults: [
      { range: '8+', effect: 'healPhysical', amount: 3, maxToStarting: true },
      { range: '6-7', effect: 'healPhysical', amount: 2, maxToStarting: true },
      { range: '4-5', effect: 'healPhysical', amount: 1, maxToStarting: true },
      { range: '0-3', effect: 'nothing' },
    ],
  },

  {
    id: 'sung_ngan',
    type: 'item',
    subtype: 'weapon',
    name: { vi: 'Súng ngắn' },
    text: {
      vi:
        'Một vũ khí lạc hậu nhưng đầy uy lực.\n' +
        'Bạn có thể dùng Súng ngắn để tấn công người khác (bằng cách đổ xúc xắc Speed, nhưng được đổ nhiều hơn 1 viên, tối đa 8 viên). Người bị tấn công cũng phải đổ xúc xắc Speed để né đạn (chịu sát thương vật lí nếu trúng đạn). Nếu đối phương né được, bạn không bị gì.\n' +
        'Vũ khí này có thể tấn công từ xa, miễn là bạn và đối phương đứng trên cùng một "đường thẳng tầm nhìn".\n' +
        'Bạn không thể sử dụng cùng lúc vũ khí khác khi đang dùng Súng ngắn.',
    },
    weapon: true,
    ranged: true,
    requiresLineOfSight: true,
    combatBonus: {
      stat: 'speed',
      extraDice: 1,
      maxDice: 8,
    },
    defenderStat: 'speed',
    exclusiveWeapon: true,
  },

  {
    id: 'thuoc_giam_dau',
    type: 'item',
    name: { vi: 'Thuốc giảm đau' },
    text: {
      vi:
        'Một chất kem, được đựng trong cái bát, bôi lên vết thương để giảm đau.\n' +
        'Bạn có thể sử dụng Thuốc bôi giảm đau lên bản thân hoặc đồng đội cùng phòng. Nếu chỉ số Might hoặc Speed của người chơi ở dưới mức khởi điểm, thì tăng lên (1 hoặc cả 2 chỉ số trên) bằng với mức khởi điểm.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    canTargetAllyInRoom: true,
    effect: 'restorePhysicalToStarting',
    consumable: true,
  },

  {
    id: 'chan_tho',
    type: 'item',
    name: { vi: 'Chân thỏ' },
    text: {
      vi:
        'Một con thỏ không may mắn.\n' +
        'Một lần mỗi lượt, bạn có thể đổ lại 1 viên xúc xắc.\n' +
        'Bạn bắt buộc phải chấp nhận kết quả đó.',
    },
    usable: true,
    usePerTurn: 1,
    effect: 'rerollOneDie',
    mustAcceptResult: true,
  },

  {
    id: 'phao_no',
    type: 'item',
    name: { vi: 'Pháo nổ' },
    text: {
      vi:
        'Bùmmmm...!\n' +
        'Bạn có thể ném Pháo nổ sang phòng liền kề (thông qua cửa ra vào).\n' +
        'Tất cả người chơi và quái vật ở căn phòng bị quăng Pháo nổ phải đổ xúc xắc Speed.\n' +
        '5+  Né được vụ nổ. Không bị sát thương.\n' +
        '0-4  Bùmmmm. Chịu 4 sát thương vật lí.\n' +
        'Hủy bỏ lá bài này sau khi sử dụng.',
    },
    usable: true,
    ranged: true,
    targetAdjacentRoom: true,
    affectsAllInTargetRoom: true,
    rollStat: 'speed',
    rollResults: [
      { range: '5+', effect: 'nothing' },
      { range: '0-4', effect: 'physicalDamage', amount: 4 },
    ],
    consumable: true,
  },
];

export const EVENTS = [
  {
    id: 'tieng_het_that_thanh',
    type: 'event',
    name: { vi: 'Tiếng hét thất thanh' },
    text: {
      vi:
        'Một tiếng thì thầm vang lên khắp căn nhà, sau đó là một tiếng thét lớn kinh hãi làm xiêu lạc hồn phách.\n' +
        'Tất cả người chơi (trừ kẻ phản bội) phải đổ xúc xắc Sanity:\n' +
        '4+  Bạn không hề sợ tiếng thét đó.\n' +
        '1-3  Chịu 1 xúc xắc sát thương tinh thần.\n' +
        '0  Chịu 2 xúc xắc sát thương tinh thần.',
    },
    immediateRoll: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '4+', effect: 'nothing' },
      { range: '1-3', effect: 'mentalDamage', dice: 1 },
      { range: '0', effect: 'mentalDamage', dice: 2 },
    ],
  },

  {
    id: 'den_tat',
    type: 'event',
    name: { vi: 'Đèn tắt' },
    text: {
      vi:
        'Đèn pin của bạn hết pin. Đừng lo lắng, bạn của bạn có pin mà!\n' +
        'Bạn giữ lại lá bài này. Từ giờ, bạn chỉ có thể đi 1 bước mỗi lượt. Cho đến khi bạn dừng lại chung phòng với một người chơi khác thì hủy lá bài này đi và bạn di chuyển như bình thường.\n' +
        'Ngoại lệ, nếu bạn có lá bài Ngọn nến hoặc dừng lại ở Lò than (Furnace room) thì lá bài này sẽ bị hủy và bạn di chuyển như bình thường.',
    },
    persistent: true,
    effect: 'movementRestriction',
    movesPerTurn: 1,
    removeConditions: ['sameRoomWithPlayer', 'hasCandle', 'inFurnaceRoom'],
  },

  {
    id: 'canh_tuong_ma_quai',
    type: 'event',
    name: { vi: 'Cảnh tượng ma quái' },
    text: {
      vi:
        'Bạn nhìn thấy cảnh một đôi nam nữ đang tổ chức hôn lễ, họ lướt đi chậm rãi trên mặt đất.\n' +
        'Bạn phải đổ xúc xắc Knowledge:\n' +
        '5+  Bạn nhận ra họ chính là chủ nhân cũ của ngôi nhà này. Bạn gọi tên họ, họ quay lại và thì thầm những bí mật đen tối của nơi này. Tăng 1 Knowledge.\n' +
        '0-4  Bạn lùi lại trong hoảng sợ tột độ. Chịu 1 xúc xắc sát thương tinh thần.',
    },
    immediateRoll: true,
    rollStat: 'knowledge',
    rollResults: [
      { range: '5+', effect: 'gainStat', stat: 'knowledge', amount: 1 },
      { range: '0-4', effect: 'mentalDamage', dice: 1 },
    ],
  },

  {
    id: 'nguoi_dan_ong_bi_thieu_song',
    type: 'event',
    name: { vi: 'Người đàn ông bị thiêu sống' },
    text: {
      vi:
        'Một người đàn ông bị thiêu sống chạy xuyên qua căn phòng. Da của hắn nổi bóng nước và nứt nẻ. Hắn té xuống trước mặt bạn, đầu lâu, xương của hắn rơi vương vãi khắp mặt đất.\n' +
        'Bạn phải đổ xúc xắc Sanity:\n' +
        '4+  Sau một thoáng, mọi thứ biến mất. Bạn thấy hơi nóng một chút, nhưng tất cả là ảo ảnh. Tăng 1 Sanity.\n' +
        '2-3  Ra ngoài, ra ngoài, bạn phải ra ngoài. Đặt nhân vật của bạn ở Lối vào sảnh chính (Entrance Hall).\n' +
        '0-1  Bạn chạy xuyên qua lửa! Chịu 1 xúc xắc sát thương vật lí và 1 xúc xắc sát thương tinh thần.',
    },
    immediateRoll: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { range: '2-3', effect: 'teleport', destination: 'entrance_hall' },
      { range: '0-1', effect: 'damage', physicalDice: 1, mentalDice: 1 },
    ],
  },

  {
    id: 'anh_phan_chieu',
    type: 'event',
    name: { vi: 'Ảnh phản chiếu (1)' },
    text: {
      vi:
        'Có một chiếc gương cũ trong phòng. Hình ảnh phản chiếu của bạn xuất hiện trong gương. Bạn nhận ra đó chính là bản thân mình ở chiều không gian khác. Kẻ trong gương viết lên dòng chữ:\n' +
        '"Thứ này sẽ giúp ích cho mày"\n' +
        'Sau đó, kẻ trong gương đưa cho bạn một vật.\n' +
        'Rút 1 lá bài Item.',
    },
    effect: 'drawItem',
    amount: 1,
  },

  {
    id: 'duong_bi_mat',
    type: 'event',
    name: { vi: 'Đường bí mật' },
    text: {
      vi:
        'Một phần bức tường mở ra. Đằng sau đó là một đường hầm đầy nấm mốc.\n' +
        'Đặt miếng token "Secret Passage" thứ nhất vào căn phòng này. Đổ 3 viên xúc xắc và đặt token "Secret Passage" thứ hai ở:\n' +
        '6+  Căn phòng bất kì.\n' +
        '4-5  Căn phòng bất kì ở tầng lầu.\n' +
        '2-3  Căn phòng bất kì ở tầng trệt.\n' +
        '0-1  Căn phòng bất kì ở tầng hầm.\n' +
        'Bạn và các người chơi khác chỉ có thể sử dụng "Secret Passage" nếu như không còn bước di chuyển nào.',
    },
    immediateRoll: true,
    fixedDice: 3,
    effect: 'placeToken',
    tokenType: 'secretPassage',
    rollResults: [
      { range: '6+', floor: 'any' },
      { range: '4-5', floor: 'upper' },
      { range: '2-3', floor: 'ground' },
      { range: '0-1', floor: 'basement' },
    ],
  },

  {
    id: 'canh_cua_tu',
    type: 'event',
    name: { vi: 'Cánh cửa tủ' },
    text: {
      vi:
        'Cánh cửa tủ kia đang mở... là một vết nứt. Có gì đó bên trong.\n' +
        'Đặt miếng token "Closet" vào căn phòng này. Một lần mỗi lượt, người chơi có thể đổ 2 viên xúc xắc để mở cửa tủ:\n' +
        '4+  Bạn mở được cửa tủ và rút một lá Item.\n' +
        '2-3  Bạn không mở được tủ và rút một lá Event.\n' +
        '0-1  Cái tủ đột nhiên biến mất, bạn nhận ra đó là ảo ảnh. Bỏ miếng token "Closet" đi và rút 1 lá Event.',
    },
    effect: 'placeToken',
    tokenType: 'closet',
    rollResults: [
      { range: '4+', effect: 'drawItem' },
      { range: '2-3', effect: 'drawEvent' },
      { range: '0-1', effect: 'removeToken', draw: 'event' },
    ],
  },

  {
    id: 'khoi',
    type: 'event',
    name: { vi: 'Khói' },
    text: {
      vi:
        'Một làn khói dày đặc bao phủ lấy bạn và căn phòng. Bạn ho dữ dội, nước mắt chảy giàn giụa.\n' +
        'Đặt miếng token "Smoke" vào căn phòng này. Đám khói sẽ cản tầm nhìn đến căn phòng liền kề.\n' +
        'Bạn phải đổ ít hơn 2 xúc xắc nếu đang ở trong căn phòng này.',
    },
    effect: 'placeToken',
    tokenType: 'smoke',
    roomEffect: {
      blocksLineOfSight: true,
      diceReduction: 2,
    },
  },

  {
    id: 'dinh_truoc_tuong_lai',
    type: 'event',
    name: { vi: 'Định trước tương lai' },
    text: {
      vi:
        'Bạn ngã sập xuống sàn nhà và cảnh tượng của tương lai tràn vào tâm trí.\n' +
        'Bạn phải chọn 1 trong 2 lựa chọn:\n' +
        'Bạn có thể nhìn trước 3 lát phòng trên cùng hoặc 3 lá bài trên cùng (Item, Event hoặc Omen) nhưng không được nói cho người khác biết.\n' +
        'Hoặc\n' +
        'Bạn đổ 4 viên xúc xắc (ghi lại kết quả ra giấy). Ở các lượt sau, khi đổ xúc xắc, bạn có thể lấy kết quả đã ghi để thay thế cho lần đổ đó.',
    },
    effect: 'choice',
    choices: [
      { type: 'peek', target: 'roomTiles', amount: 3 },
      { type: 'peek', target: 'cardDeck', amount: 3 },
      { type: 'storeDiceRoll', dice: 4 },
    ],
  },

  {
    id: 'nguoi_lam_vuon',
    type: 'event',
    name: { vi: 'Người làm vườn' },
    text: {
      vi:
        'Bạn nhìn thấy một người đàn ông mặc bộ đồ làm vườn. Ông ta giơ cái xẻng lên tấn công bạn. Khi chỉ còn cách bạn vài cm, hắn đột nhiên biến mất, để lại những dấu giày đầy bùn đất.\n' +
        'Bạn phải đổ xúc xắc Knowledge (Nếu đang ở trong Khu vườn (Gardens), bạn đổ ít hơn 2 xúc xắc).\n' +
        '4+  Bạn tìm thấy gì đó trong đám bùn đất. Rút 1 lá Item.\n' +
        '0-3  Hắn ta xuất hiện trở lại và tấn công bạn. Người chơi bên phải bạn đổ 4 viên xúc xắc để tính sát thương lên bạn. Bạn phòng thủ bằng cách đổ xúc xắc Might như bình thường.',
    },
    immediateRoll: true,
    rollStat: 'knowledge',
    roomModifier: { room: 'gardens', diceReduction: 2 },
    rollResults: [
      { range: '4+', effect: 'drawItem' },
      { range: '0-3', effect: 'attack', attackerDice: 4, defenderStat: 'might' },
    ],
  },

  {
    id: 'thu_gi_do_an_giau',
    type: 'event',
    name: { vi: 'Thứ gì đó ẩn giấu' },
    text: {
      vi:
        'Có thứ gì đó đang được ẩn giấu trong căn phòng này, nhưng nó là cái gì? Điều đó làm bạn thấy không an tâm.\n' +
        'Nếu bạn muốn tìm thứ đó, thì hãy đổ xúc xắc Knowledge:\n' +
        '4+  Một phần của bức tường rơi ra, để lộ ra một khoảng trống nhỏ. Bạn tìm thấy một vật trong đó. Rút 1 lá bài Item.\n' +
        '0-3  Bạn không hề tìm thấy gì và điều đó làm bạn hơi bất an. Mất 1 Sanity.',
    },
    optional: true,
    rollStat: 'knowledge',
    rollResults: [
      { range: '4+', effect: 'drawItem' },
      { range: '0-3', effect: 'loseStat', stat: 'sanity', amount: 1 },
    ],
  },

  {
    id: 'nguoi_treo_co',
    type: 'event',
    name: { vi: 'Người treo cổ' },
    text: {
      vi:
        'Bạn bị sốc nặng khi trước mặt là ba người đàn ông bị treo cổ. Họ đang đung đưa qua lại và liếc nhìn bạn với ánh mắt sắc lạnh. Sau đó cả ba tan dần trong đám bụi mờ ảo. Bạn sắp loạn trí mất rồi.\n' +
        'Bạn phải đổ xúc xắc Might, Speed, Sanity và Knowledge (đổ 4 lần):\n' +
        '2+  Chỉ số đó không bị gì.\n' +
        '0-1  Mất 1 nấc chỉ số đó.\n' +
        'Nếu bạn đổ được 2+ trong cả bốn lần, thì tăng 2 nấc một chỉ số bất kì.',
    },
    immediateRoll: true,
    rollStats: ['might', 'speed', 'sanity', 'knowledge'],
    rollResults: [
      { range: '2+', effect: 'nothing' },
      { range: '0-1', effect: 'loseStat', amount: 1 },
    ],
    bonusCondition: {
      condition: 'allRollsPass',
      threshold: 2,
      reward: { effect: 'gainStat', amount: 2, choice: true },
    },
  },

  {
    id: 'con_nhen',
    type: 'event',
    name: { vi: 'Con nhện' },
    text: {
      vi:
        'Một con nhện kích thước khủng bò lên trên vai bạn.\n' +
        'Bạn phải đổ xúc xắc Speed hoặc Sanity:\n' +
        '4+  Con nhện biến mất, tăng 1 nấc của chỉ số mà bạn đã dùng để đổ xúc xắc.\n' +
        '1-3  Con nhện cắn bạn, chịu 1 xúc xắc sát thương vật lí.\n' +
        '0  Con nhện cắn bạn liên tục nhiều lần. Chịu 2 xúc xắc sát thương vật lí.',
    },
    immediateRoll: true,
    rollStat: ['speed', 'sanity'],
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'rolled', amount: 1 },
      { range: '1-3', effect: 'physicalDamage', dice: 1 },
      { range: '0', effect: 'physicalDamage', dice: 2 },
    ],
  },

  {
    id: 'bay_con_trung_kinh_di',
    type: 'event',
    name: { vi: 'Bầy côn trùng kinh dị' },
    text: {
      vi:
        'Hàng ngàn con bọ tràn lên mặt bạn, chúng chui vào quần áo, bò ngoe nguẩy trên da, luồn lách trong tóc bạn.\n' +
        'Bạn phải đổ xúc xắc Sanity:\n' +
        '5+  Bạn chớp mắt, bọn chúng biến mất. Thì ra chỉ là ảo ảnh. Tăng 1 Sanity.\n' +
        '1-4  Mất 1 Sanity.\n' +
        '0  Mất 2 Sanity.',
    },
    immediateRoll: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '5+', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { range: '1-4', effect: 'loseStat', stat: 'sanity', amount: 1 },
      { range: '0', effect: 'loseStat', stat: 'sanity', amount: 2 },
    ],
  },

  {
    id: 'mui_hoi_thoi',
    type: 'event',
    name: { vi: 'Mùi hôi thối' },
    text: {
      vi:
        'Mùi của căn phòng này cực kì kinh tởm. Ngửi như mùi của xác thịt trộn với máu tanh.\n' +
        'Bạn phải đổ xúc xắc Sanity:\n' +
        '5+  Chỉ là một mùi khó chịu thôi mà, chẳng có gì cả! Tăng 1 Sanity.\n' +
        '2-4  Mất 1 Might.\n' +
        '1  Mất 1 Might và 1 Speed.\n' +
        '0  Bạn nôn mửa thảm tệ. Mất 1 Might, 1 Speed, 1 Knowledge và 1 Sanity.',
    },
    immediateRoll: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '5+', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { range: '2-4', effect: 'loseStat', stat: 'might', amount: 1 },
      { range: '1', effect: 'loseStats', stats: { might: 1, speed: 1 } },
      { range: '0', effect: 'loseStats', stats: { might: 1, speed: 1, knowledge: 1, sanity: 1 } },
    ],
  },

  {
    id: 'canh_tuong_mau_me',
    type: 'event',
    name: { vi: 'Cảnh tượng máu me' },
    text: {
      vi:
        'Những bức tường của căn phòng này thấm đẫm máu. Máu nhỏ giọt xuống từ trần nhà, từ các bức tường, từ đồ đạc xung quanh và dính lên giày bạn. Bạn chớp mắt, tất cả mọi thứ biến mất!!! Là ảo ảnh sao?\n' +
        'Bạn phải đổ xúc xắc Sanity:\n' +
        '4+  Bạn lấy lại bình tĩnh. Tăng 1 Sanity.\n' +
        '2-3  Bạn sợ hãi và mất 1 Sanity.\n' +
        '0-1  Bạn trở nên điên loạn. Nếu có quái vật hoặc đồng đội ở căn phòng liền kề, bạn bắt buộc phải tấn công họ (nếu có thể, chọn người có chỉ số Might thấp nhất).',
    },
    immediateRoll: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { range: '2-3', effect: 'loseStat', stat: 'sanity', amount: 1 },
      { range: '0-1', effect: 'forcedAttack', target: 'adjacentLowestMight' },
    ],
  },

  {
    id: 'luot_cua_jonah',
    type: 'event',
    name: { vi: 'Lượt của Jonah' },
    text: {
      vi:
        'Hai đứa trẻ đang chơi với một con quay gỗ. "Cậu muốn chơi thử một lần không, Jonah?" một đứa nói.\n' +
        '"Không", Jonah trả lời, "Tôi muốn chơi nó một mình thôi". Jonah giật lấy con quay và đánh vào mặt cậu bé kia. Nó té xuống đất, Jonah vẫn tiếp tục đánh cho đến khi cả hai bọn chúng dần tan biến.\n' +
        'Nếu một người chơi có lá bài "Hộp lắp ghép", thì người chơi đó phải hủy bỏ nó và rút 1 lá Item mới để thay thế. Khi điều này xảy ra, bạn được tăng 1 Sanity; nếu không, bạn chịu 1 xúc xắc sát thương tinh thần.',
    },
    effect: 'conditional',
    condition: { anyPlayerHas: 'hop_lac_ghep' },
    ifTrue: {
      targetPlayer: { effect: 'discardItem', item: 'hop_lac_ghep', then: 'drawItem' },
      currentPlayer: { effect: 'gainStat', stat: 'sanity', amount: 1 },
    },
    ifFalse: { effect: 'mentalDamage', dice: 1 },
  },

  {
    id: 'chat_nhay_kinh_tom',
    type: 'event',
    name: { vi: 'Chất nhầy kinh tởm' },
    text: {
      vi:
        'Thứ gì đang ở xung quanh chân bạn kìa? Côn trùng? Máu đông? Bãi nôn?\n' +
        'Bạn phải đổ xúc xắc Speed để nhấc chân ra khỏi đám chất nhầy bẩn thỉu kinh tởm đó.\n' +
        '4+  Bạn nhanh chóng thoát ra được, tăng 1 Speed.\n' +
        '1-3  Mất 1 Might.\n' +
        '0  Mất 1 Speed và 1 Might.',
    },
    immediateRoll: true,
    rollStat: 'speed',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'speed', amount: 1 },
      { range: '1-3', effect: 'loseStat', stat: 'might', amount: 1 },
      { range: '0', effect: 'loseStats', stats: { speed: 1, might: 1 } },
    ],
  },

  {
    id: 'anh_phan_chieu_2',
    type: 'event',
    name: { vi: 'Ảnh phản chiếu (2)' },
    text: {
      vi:
        'Nếu bạn không có lá bài Item nào thì lá event này sẽ dành cho người chơi ở bên trái của bạn (nếu người đó có lá Item). Hủy bỏ lá bài này nếu tất cả người chơi đều không có lá Item nào.\n' +
        'Có một chiếc gương cũ trong phòng. Hình ảnh phản chiếu của bạn xuất hiện trong gương. Bạn nhận ra đó chính là bản thân mình ở chiều không gian khác. Kẻ trong gương viết lên dòng chữ:\n' +
        '"Thứ này sẽ giúp ích cho tao"\n' +
        'Sau đó, kẻ trong gương giật lấy vật trên tay bạn.\n' +
        'Chọn một trong các lá bài Item của bạn đang sở hữu và trả nó về chồng bài. Xào lại chồng bài đó và bạn được tăng 1 Knowledge.',
    },
    effect: 'conditional',
    condition: { currentPlayerHas: 'anyItem' },
    passToLeft: true,
    ifTrue: {
      effect: 'returnItemToDeck',
      then: { effect: 'gainStat', stat: 'knowledge', amount: 1 },
    },
    ifFalse: { effect: 'discard' },
  },

  {
    id: 'ket_sat_bi_khoa',
    type: 'event',
    name: { vi: 'Két sắt bị khóa' },
    text: {
      vi:
        'Đằng sau tấm chân dung trên tường là một cái két sắt bị khóa. Nó có bẫy chống trộm. Cẩn thận đấy!\n' +
        'Đặt miếng token "Safe" (két sắt) vào trong căn phòng.\n' +
        'Một lần mỗi lượt, người chơi có thể đổ xúc xắc Knowledge để mở két sắt:\n' +
        '5+  Bạn mở được két, bỏ miếng token đi và bạn được rút 2 lá bài Item.\n' +
        '2-4  Bạn bị kẹt ngón tay, chịu 1 xúc xắc sát thương vật lí. Két sắt vẫn khóa.\n' +
        '0-1  Bạn bị đứt lìa một ngón tay khi mở két, chịu 2 xúc xắc sát thương vật lí. Két sắt vẫn khóa.',
    },
    effect: 'placeToken',
    tokenType: 'safe',
    tokenInteraction: {
      rollStat: 'knowledge',
      rollResults: [
        { range: '5+', effect: 'removeToken', then: { effect: 'drawItem', amount: 2 } },
        { range: '2-4', effect: 'physicalDamage', dice: 1 },
        { range: '0-1', effect: 'physicalDamage', dice: 2 },
      ],
    },
  },

  {
    id: 'gio_gao_thet',
    type: 'event',
    name: { vi: 'Gió gào thét' },
    text: {
      vi:
        'Gió đột nhiên nổi lên, tăng dần từ nhè nhẹ đến mạnh như bão tố.\n' +
        'Mỗi người chơi đang ở trong Khu vườn, Nghĩa địa, Sân trong nhà, Tháp, Ban công (Gardens, Graveyard, Patio, Tower, Balcony) hoặc ở trong căn phòng có cửa sổ thông ra ngoài trời phải đổ xúc xắc Might.\n' +
        '5+  Bạn vẫn đứng vững trước gió bão.\n' +
        '3-4  Gió hất ngã bạn, chịu 1 xúc xắc sát thương vật lí.\n' +
        '1-2  Gió như đang hút linh hồn bạn, chịu 1 xúc xắc sát thương tinh thần.\n' +
        '0  Gió hất bạn ngã mạnh xuống sàn, chịu một xúc xắc sát thương vật lí. Đặt một trong các Item của bạn (nếu có) ở Lối vào sảnh chính (Entrance Hall).',
    },
    affectsAllPlayers: true,
    affectedRooms: ['gardens', 'graveyard', 'patio', 'tower', 'balcony'],
    affectedRoomCondition: 'hasOutdoorWindow',
    rollStat: 'might',
    rollResults: [
      { range: '5+', effect: 'nothing' },
      { range: '3-4', effect: 'physicalDamage', dice: 1 },
      { range: '1-2', effect: 'mentalDamage', dice: 1 },
      { range: '0', effect: 'physicalDamage', dice: 1, then: { effect: 'dropItem', location: 'entrance_hall' } },
    ],
  },

  {
    id: 'su_im_lang',
    type: 'event',
    name: { vi: 'Sự im lặng' },
    text: {
      vi:
        'Dưới mặt đất, tất cả mọi thứ đều trở nên lặng thinh, bạn chỉ còn nghe thấy tiếng hơi thở của mình.\n' +
        'Mỗi người chơi ở dưới tầng hầm phải đổ xúc xắc Sanity:\n' +
        '4+  Bạn là người gan dạ, một chút yên lặng chẳng là gì cả.\n' +
        '1-3  Bạn hét lên nhưng lại không thể nghe thấy tiếng của chính mình. Chịu 1 xúc xắc sát thương tinh thần.\n' +
        '0  Bạn bị sốc, chịu 2 xúc xắc sát thương tinh thần.',
    },
    affectsAllPlayers: true,
    affectedFloor: 'basement',
    rollStat: 'sanity',
    rollResults: [
      { range: '4+', effect: 'nothing' },
      { range: '1-3', effect: 'mentalDamage', dice: 1 },
      { range: '0', effect: 'mentalDamage', dice: 2 },
    ],
  },

  {
    id: 'mang_nhen',
    type: 'event',
    name: { vi: 'Mạng nhện' },
    text: {
      vi:
        'Đột nhiên, bạn bị vướng vào đống mạng nhện bên cạnh... nhưng chúng không bị đứt mà dính chặt vào người bạn. Bạn có nguy cơ bị kẹt.\n' +
        'Bạn phải đổ xúc xắc Might:\n' +
        '4+  Bạn thoát được, tăng 1 Might và hủy bỏ lá bài này.\n' +
        '0-3  Bạn bị kẹt cứng trong đó, giữ lại lá bài này.\n' +
        'Nếu bạn bị mắc kẹt trong mạng nhện, thì bạn không thể làm gì. Giữ lại lá bài này. Một lần ở mỗi lượt sau, bạn phải đổ xúc xắc Might được 4+ để tự giải thoát bản thân khỏi bị kẹt (người cùng phòng với bạn cũng có thể đổ xúc xắc Might được 4+ để giải cứu bạn) (không được tăng 1 Might). Nếu đồng đội giải cứu bạn thất bại thì họ cũng bị mắc kẹt. Sau 3 lần giải cứu bạn không thành công, tất cả người bị kẹt sẽ mặc định được thoát ra, di chuyển như bình thường và hủy bỏ lá bài này.',
    },
    immediateRoll: true,
    rollStat: 'might',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'might', amount: 1, discard: true },
      { range: '0-3', effect: 'trapped' },
    ],
    persistent: true,
    trappedEffect: {
      escapeRoll: { stat: 'might', threshold: 4 },
      allyCanHelp: true,
      allyFailure: 'alsoTrapped',
      autoEscapeAfter: 3,
    },
  },

  {
    id: 'bo_hai_cot',
    type: 'event',
    name: { vi: 'Bộ hài cốt' },
    text: {
      vi:
        'Bạn tìm thấy một nửa thân trên của bộ hài cốt đang bị chôn dưới đất.\n' +
        'Đặt miếng token "Skeletons" vào căn phòng này. Chịu 1 xúc xắc sát thương tinh thần.\n' +
        'Một lần mỗi lượt, người chơi trong căn phòng này có thể đổ xúc xắc Sanity để đào bộ hài cốt lên:\n' +
        '5+  Bạn đào và tìm thấy nửa thân dưới của bộ hài cốt, đồng thời nhặt được một vật dụng. Rút một lá Item. Bỏ miếng token "Skeletons" đi.\n' +
        '0-3  Bạn đào mãi nhưng không tìm thấy nửa phần thân còn lại của bộ hài cốt đâu. Chịu 1 xúc xắc sát thương tinh thần.',
    },
    immediateEffect: { effect: 'mentalDamage', dice: 1 },
    effect: 'placeToken',
    tokenType: 'skeletons',
    tokenInteraction: {
      rollStat: 'sanity',
      rollResults: [
        { range: '5+', effect: 'removeToken', then: { effect: 'drawItem' } },
        { range: '0-3', effect: 'mentalDamage', dice: 1 },
      ],
    },
  },

  {
    id: 'ai_do_bi_lac',
    type: 'event',
    name: { vi: 'Ai đó bị lạc' },
    text: {
      vi:
        'Một người phụ nữ mặc đồ thời chiến tranh vẫy tay mời gọi bạn. Bạn đã bị mê hoặc.\n' +
        'Bạn phải đổ xúc xắc Knowledge. Nếu kết quả là 5+ thì bạn thoát khỏi sự mê hoặc và tăng 1 Knowledge. Nếu không, bạn phải đổ 3 xúc xắc để xác định điểm đến khi bị mê hoặc:\n' +
        '6  Đặt nhân vật của bạn ở Lối vào sảnh chính (Entrance Hall).\n' +
        '4-5  Đặt nhân vật của bạn ở Chiếu nghỉ tầng lầu (Upper Landing).\n' +
        '2-3  Rút một lát phòng tầng lầu, đặt nhân vật của bạn vào đó.\n' +
        '0-1  Rút một lát phòng tầng hầm, đặt nhân vật của bạn vào đó.',
    },
    rollStat: 'knowledge',
    rollResults: [
      { range: '5+', effect: 'gainStat', stat: 'knowledge', amount: 1 },
      {
        range: '0-4',
        effect: 'secondRoll',
        dice: 3,
        secondRollResults: [
          { range: '6', effect: 'teleport', destination: 'entrance_hall' },
          { range: '4-5', effect: 'teleport', destination: 'upper_landing' },
          { range: '2-3', effect: 'drawRoomTile', floor: 'upper', teleportTo: true },
          { range: '0-1', effect: 'drawRoomTile', floor: 'basement', teleportTo: true },
        ],
      },
    ],
  },

  {
    id: 'cuoc_goi_den',
    type: 'event',
    name: { vi: 'Cuộc gọi đến' },
    text: {
      vi:
        'Một chiếc điện thoại reo lên trong phòng. Có vẻ bạn bắt buộc phải trả lời.\n' +
        'Đổ 2 viên xúc xắc. Giọng nói ngọt ngào của một bà lão cất lên:\n' +
        '4+  "Trà và bánh ngọt! Trà và bánh ngọt! Món yêu thích của taaaa". Tăng 1 Sanity.\n' +
        '3  "Ta luôn ở đây vì người, bánh ngọt ơi. Coi chừng đó...". Tăng 1 Knowledge.\n' +
        '1-2  "Ta ở ngay đây, kẹo ngọt ơi! Hôn ta đi nàooooo!". Chịu 1 xúc xắc sát thương tinh thần.\n' +
        '0  "Trẻ hư thì phải bị phạt". Chịu 2 xúc xắc sát thương vật lí.',
    },
    immediateRoll: true,
    fixedDice: 2,
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { range: '3', effect: 'gainStat', stat: 'knowledge', amount: 1 },
      { range: '1-2', effect: 'mentalDamage', dice: 1 },
      { range: '0', effect: 'physicalDamage', dice: 2 },
    ],
  },

  {
    id: 'am_thanh_bat_an',
    type: 'event',
    name: { vi: 'Âm thanh bất an' },
    text: {
      vi:
        'Tiếng khóc của một đứa bé, lạc lõng và bị bỏ rơi. Một tiếng la hét. Tiếng cửa kính vỡ. Sau đó mọi thứ im bặt.\n' +
        'Đổ 6 viên xúc xắc. Nếu bạn được số điểm lớn hơn hoặc bằng số lá Omen hiện có, bạn được tăng 1 Sanity. Nếu không, bạn chịu 1 xúc xắc sát thương tinh thần.',
    },
    immediateRoll: true,
    fixedDice: 6,
    compareToOmenCount: true,
    rollResults: [
      { condition: 'rollGreaterOrEqualOmen', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { condition: 'rollLessThanOmen', effect: 'mentalDamage', dice: 1 },
    ],
  },

  {
    id: 'manh_vo',
    type: 'event',
    name: { vi: 'Mảnh vỡ' },
    text: {
      vi:
        'Nhiều miếng vữa lớn rơi xuống từ bức tường và trần nhà.\n' +
        'Bạn phải đổ xúc xắc Speed:\n' +
        '3+  Bạn né được, tăng 1 Speed.\n' +
        '1-2  Bạn bị những miếng vữa rơi trúng và đè trên người. Chịu 1 xúc xắc sát thương vật lí.\n' +
        '0  Bạn bị rất nhiều miếng vữa rơi trúng và đè trên người. Chịu 2 xúc xắc sát thương vật lí.\n' +
        'Nếu bạn bị miếng vữa đè lên người (kết quả 0-2), thì bạn không thể làm gì. Giữ lại lá bài này. Một lần ở mỗi lượt sau, bạn phải đổ xúc xắc Might được 4+ để tự giải thoát bản thân (người cùng phòng với bạn cũng có thể đổ xúc xắc Might được 4+ để giải cứu bạn). Nếu sau 3 lượt không thành công, bạn mặc định được thoát, di chuyển bình thường và hủy bỏ lá bài này.',
    },
    immediateRoll: true,
    rollStat: 'speed',
    rollResults: [
      { range: '3+', effect: 'gainStat', stat: 'speed', amount: 1 },
      { range: '1-2', effect: 'physicalDamage', dice: 1, then: 'trapped' },
      { range: '0', effect: 'physicalDamage', dice: 2, then: 'trapped' },
    ],
    persistent: true,
    trappedEffect: {
      escapeRoll: { stat: 'might', threshold: 4 },
      allyCanHelp: true,
      autoEscapeAfter: 3,
    },
  },

  {
    id: 'tieng_buoc_chan',
    type: 'event',
    name: { vi: 'Tiếng bước chân' },
    text: {
      vi:
        'Sàn nhà chậm rãi kêu cọt kẹt, bụi bốc lên. Dấu chân xuất hiện trên mặt sàn đầy bụi. Khi dấu chân tiến đến trước mặt bạn, chúng đột nhiên biến mất.\n' +
        'Bạn phải đổ 1 viên xúc xắc. (Nếu có một đồng đội ở Nhà thờ (Chapel), người đó cũng đổ 1 viên xúc xắc và cộng số điểm của hai người lại).\n' +
        '4  Bạn và người chơi gần nhất tăng 1 Might.\n' +
        '3  Bạn được tăng 1 Might và người chơi gần nhất mất 1 Sanity.\n' +
        '2  Bạn mất 1 Sanity.\n' +
        '1  Bạn mất 1 Speed.\n' +
        '0  Mỗi người chơi mất 1 nấc chỉ số (tự chọn chỉ số).',
    },
    rollDice: 1,
    chapelBonus: { addDice: 1, fromAlly: true },
    rollResults: [
      { range: '4', effect: 'gainStat', stat: 'might', amount: 1, nearestPlayer: { effect: 'gainStat', stat: 'might', amount: 1 } },
      { range: '3', effect: 'gainStat', stat: 'might', amount: 1, nearestPlayer: { effect: 'loseStat', stat: 'sanity', amount: 1 } },
      { range: '2', effect: 'loseStat', stat: 'sanity', amount: 1 },
      { range: '1', effect: 'loseStat', stat: 'speed', amount: 1 },
      { range: '0', effect: 'allPlayersLoseStat', amount: 1, choice: true },
    ],
  },

  {
    id: 'buc_tuong_thit',
    type: 'event',
    name: { vi: 'Bức tường thịt' },
    text: {
      vi:
        'Căn phòng này tỏa ra hơi ấm. Các bức tường như được làm từ xác thịt và nó đang rung động như nhịp tim. Nhịp tim của bạn cũng đập theo nhịp của căn phòng. Bất chợt bạn bị kéo vào bên trong bức tường... và bạn xuất hiện ở một căn phòng khác.\n' +
        'Bạn phải rút một lát phòng mới và đặt nó ở bất cứ đâu trong ngôi nhà. Đặt nhân vật của bạn vào căn phòng vừa rút đó.',
    },
    effect: 'drawRoomTile',
    floor: 'any',
    teleportTo: true,
  },

  {
    id: 'toang_toang_toang',
    type: 'event',
    name: { vi: 'Toang... Toang... Toang...' },
    text: {
      vi:
        'Một âm thanh sắc bén kêu lên đều đặn theo nhịp như những mũi kim châm vào não bạn.\n' +
        'Đặt miếng token "Drip" vào căn phòng này. Mọi người chơi đang ở trong căn phòng này nếu bị yêu cầu đổ xúc xắc thì phải đổ ít hơn 1 viên (tối thiểu 1 xúc xắc).',
    },
    effect: 'placeToken',
    tokenType: 'drip',
    roomEffect: {
      diceReduction: 1,
      minimumDice: 1,
    },
  },

  {
    id: 'dat_mo',
    type: 'event',
    name: { vi: 'Đất mộ' },
    text: {
      vi:
        'Căn phòng này được che phủ bởi một lớp móng đất đá. Bạn ho dữ dội khi hít bụi từ lớp đất đó và cơ thể bạn bị ngứa ngáy liên hồi khi bụi bám lên da.\n' +
        'Bạn phải đổ xúc xắc Might:\n' +
        '4+  Bạn lắc mạnh quần áo và cơ thể để bụi rơi ra. Tăng 1 Might.\n' +
        '0-3  Có gì đó sai sai. Giữ lại lá bài này. Giảm 1 nấc chỉ số vật lí vào đầu mỗi lượt tới của bạn. Hủy bỏ lá bài này đi nếu bạn được một lá bài Item khác tăng 1 chỉ số bất kì hoặc bạn kết thúc lượt ở tại Ban công, Khu vườn, Nghĩa địa, Phòng Gym, Kho lương thực, Sân trong nhà, Tòa tháp (Balcony, Gardens, Graveyard, Gymnasium, Larder, Patio, Tower).',
    },
    immediateRoll: true,
    rollStat: 'might',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'might', amount: 1 },
      { range: '0-3', effect: 'persistent' },
    ],
    persistent: true,
    persistentEffect: {
      onTurnStart: { effect: 'loseStat', statType: 'physical', amount: 1 },
      removeConditions: [
        'gainStatFromItem',
        { endTurnIn: ['balcony', 'gardens', 'graveyard', 'gymnasium', 'larder', 'patio', 'tower'] },
      ],
    },
  },

  {
    id: 'cua_xoay',
    type: 'event',
    name: { vi: 'Cửa xoay' },
    text: {
      vi:
        'Cái cửa xoay dẫn đến một nơi khác.\n' +
        'Đặt miếng token "Wall Switch" vào bức tường hoặc góc tường nơi không có cánh cửa nào. Đặt nhân vật của bạn đến căn phòng ở phía sau miếng token (nếu không có căn phòng nào ở đó, rút một lát phòng mới đặt vào. Nếu không còn lát phòng nào thì hủy bỏ lá bài này).\n' +
        'Ở các lượt sau, người chơi nào ở 1 trong 2 căn phòng có cửa xoay có thể đổ xúc xắc Knowledge để sử dụng:\n' +
        '3+  Tìm thấy cửa xoay và sử dụng (không tốn bước di chuyển).\n' +
        '4-5  Không thể tìm thấy cửa xoay để sử dụng.',
    },
    effect: 'placeToken',
    tokenType: 'wallSwitch',
    tokenPlacement: 'wallWithoutDoor',
    teleportBehindToken: true,
    tokenInteraction: {
      rollStat: 'knowledge',
      rollResults: [
        { range: '3+', effect: 'useWallSwitch', freeMove: true },
        { range: '0-2', effect: 'nothing' },
      ],
    },
  },

  {
    id: 'chiem_huu',
    type: 'event',
    name: { vi: 'Chiếm hữu' },
    text: {
      vi:
        'Bạn bị sốc khi thấy một cái bóng hiện lên trên tường. Nó bao vây và nhập vào linh hồn bạn.\n' +
        'Bạn phải chọn một chỉ số bất kì để đổ xúc xắc:\n' +
        '4+  Bạn kháng cự lại cái bóng. Tăng 1 nấc của chỉ số mà bạn đã chọn dùng để đổ xúc xắc.\n' +
        '0-3  Cái bóng hút hết sinh lực của bạn. Chỉ số mà bạn đã chọn để đổ xúc xắc bị giảm xuống mức thấp nhất (trên mức đầu lâu). Nếu chỉ số đó đã ở mức thấp nhất từ trước, thì hãy chọn 1 chỉ số khác để thay thế.',
    },
    immediateRoll: true,
    rollStat: 'choice',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'rolled', amount: 1 },
      { range: '0-3', effect: 'setStatToLowest', stat: 'rolled' },
    ],
  },

  {
    id: 'what_the_f',
    type: 'event',
    name: { vi: 'What the F...?' },
    text: {
      vi:
        'Khi bạn nhìn lại phía sau lưng - hướng đi vào căn phòng của bạn, bạn thấy......chẳng thấy gì cả!!! Chỉ là một màn sương đêm sâu thẳm. Căn phòng lúc nãy mà bạn đứng biến đâu rồi?\n' +
        'Nhặt lên miếng lát phòng mà bạn đang đứng và đặt nó vào một chỗ khác trong tầng này (sao cho nó khớp với một cách cửa của một căn phòng đã khám phá khác). Nếu không thể đặt miếng lát phòng của bạn khớp với một căn phòng ở tầng này, hãy đặt ở một tầng khác.',
    },
    effect: 'relocateCurrentRoom',
    sameFloorPreferred: true,
  },

  {
    id: 'lao_gia_an_xin',
    type: 'event',
    name: { vi: 'Lão già ăn xin' },
    text: {
      vi:
        'Bạn nhìn thấy một lão già, làn da nứt nẻ, ho dữ dội. Ông ta đưa bàn tay ra xin bạn ít đồng tiền lẻ.\n' +
        'Bạn phải chọn 1 trong 2 lựa chọn sau: cho ông ta ít tiền hoặc không.\n' +
        'Nếu bạn chọn không cho tiền, không có gì xảy ra, chỉ cần lờ ông ta đi thôi.\n' +
        'Hoặc\n' +
        'Nếu bạn chọn cho tiền thì hãy đổ xúc xắc Knowledge:\n' +
        '4+  Ông ta đưa cho bạn một vật để trả ơn. Rút 1 lá Item.\n' +
        '0-3  Ông ta chìa tay nhận tiền, để lộ cánh tay thối rữa, đầy giòi bọ bò lúc nhúc. Bạn sợ hãi, nôn thốc nôn tháo. Mất 2 Might và 1 Speed.',
    },
    effect: 'choice',
    choices: [
      { type: 'ignore', effect: 'nothing' },
      {
        type: 'giveMoney',
        rollStat: 'knowledge',
        rollResults: [
          { range: '4+', effect: 'drawItem' },
          { range: '0-3', effect: 'loseStats', stats: { might: 2, speed: 1 } },
        ],
      },
    ],
  },

  {
    id: 'khoanh_khac_hi_vong',
    type: 'event',
    name: { vi: 'Khoảnh khắc hi vọng' },
    text: {
      vi:
        'Có gì đó rất khác lạ với căn phòng này. Dường như có một thế lực chống lại ma quỷ đang hiện diện ở đây.\n' +
        'Đặt miếng token "Blessing" trong căn phòng này.\n' +
        'Mỗi người chơi phe chính diện được đổ nhiều hơn 1 viên xúc xắc khi đang ở trong căn phòng này.',
    },
    effect: 'placeToken',
    tokenType: 'blessing',
    roomEffect: {
      heroesOnly: true,
      diceBonus: 1,
    },
  },

  {
    id: 'cau_thang_bi_mat',
    type: 'event',
    name: { vi: 'Cầu thang bí mật' },
    text: {
      vi:
        'Một âm thanh cọt kẹt rợn người vang vọng khắp phòng. Bạn đã tìm thấy một chiếc cầu thang bí mật.\n' +
        'Đặt miếng token "Secret Stairs" thứ nhất vào căn phòng này và miếng token "Secret Stairs" thứ hai vào một căn phòng bất kì ở tầng khác (tự chọn).\n' +
        'Bạn và người chơi khác chỉ có thể sử dụng cầu thang bí mật nếu không còn bước di chuyển nào.\n' +
        'Nếu bạn sử dụng cầu thang bí mật, hãy rút 1 lá bài Event khi đi đến căn phòng mới.',
    },
    effect: 'placeToken',
    tokenType: 'secretStairs',
    tokenCount: 2,
    secondTokenPlacement: 'differentFloor',
    useCondition: 'noMovesLeft',
    onUse: { effect: 'drawEvent' },
  },

  {
    id: 'lan_suong_ki_la',
    type: 'event',
    name: { vi: 'Làn sương kì lạ' },
    text: {
      vi:
        'Sương mù tỏa ra từ các vết nứt trên tường. Bạn nhìn thấy những khuôn mặt đang ẩn hiện trong làn sương đó. Có khuôn mặt của con người và cả của thứ không phải con người.\n' +
        'Mỗi người chơi ở dưới tầng hầm phải đổ xúc xắc Sanity:\n' +
        '4+  Những khuôn mặt đó chỉ là hiện tượng phản chiếu ánh sáng thôi.\n' +
        '1-3  Chịu 1 xúc xắc sát thương tinh thần (và chịu thêm 1 xúc xắc sát thương vật lí nếu người chơi đó đang ở trong căn phòng có biểu tượng Event).\n' +
        '0  Chịu 1 xúc xắc sát thương tinh thần (và chịu thêm 2 xúc xắc sát thương vật lí nếu người chơi đó đang ở trong căn phòng có biểu tượng Event).',
    },
    affectsAllPlayers: true,
    affectedFloor: 'basement',
    rollStat: 'sanity',
    rollResults: [
      { range: '4+', effect: 'nothing' },
      { range: '1-3', effect: 'mentalDamage', dice: 1, eventRoomBonus: { effect: 'physicalDamage', dice: 1 } },
      { range: '0', effect: 'mentalDamage', dice: 1, eventRoomBonus: { effect: 'physicalDamage', dice: 2 } },
    ],
  },

  {
    id: 'sinh_vat_tuc_gian',
    type: 'event',
    name: { vi: 'Sinh vật tức giận' },
    text: {
      vi:
        'Một sinh vật gì đó nổi lên từ đám chất nhầy ở trên bức tường bên cạnh bạn.\n' +
        'Bạn phải đổ xúc xắc Speed:\n' +
        '5+  Bạn chạy thoát được. Tăng 1 Speed.\n' +
        '2-4  Bạn chịu 1 xúc xắc sát thương tinh thần.\n' +
        '0-1  Bạn chịu 1 xúc xắc sát thương tinh thần và 1 xúc xắc sát thương vật lí.',
    },
    immediateRoll: true,
    rollStat: 'speed',
    rollResults: [
      { range: '5+', effect: 'gainStat', stat: 'speed', amount: 1 },
      { range: '2-4', effect: 'mentalDamage', dice: 1 },
      { range: '0-1', effect: 'damage', mentalDice: 1, physicalDice: 1 },
    ],
  },

  {
    id: 'whoops',
    type: 'event',
    name: { vi: 'Whoops!' },
    text: {
      vi:
        'Bạn bị một vật gì đó ngáng ở dưới chân. Trước khi bạn kịp nhảy lên thì đã bị vấp ngã. Một giọng cười khúc khích vang lên rồi nhỏ dần.\n' +
        'Lật úp tất cả các lá bài Item của bạn lại và xào chúng lên. Người chơi ở bên phải của bạn sẽ chọn một lá ngẫu nhiên để hủy bỏ nó. Sau đó, những lá bài Item còn lại bạn vẫn sử dụng như bình thường.',
    },
    effect: 'shuffleItems',
    rightPlayerChoosesDiscard: true,
  },

  {
    id: 'cau_truot_huyen_bi',
    type: 'event',
    name: { vi: 'Cầu trượt huyền bí' },
    text: {
      vi:
        'Nếu bạn đang ở tầng hầm, lá bài này sẽ tác dụng lên người chơi tiếp theo ở bên trái của bạn (nếu họ không ở tầng hầm). Hủy bỏ lá bài này nếu toàn bộ người chơi đang ở tầng hầm.\n' +
        'Một phần sàn nhà bị nghiêng và sập xuống, bạn có thể trượt xuống phía dưới nếu muốn.\n' +
        'Đặt 1 miếng token "Slide" trong căn phòng này.\n' +
        'Bạn có thể đổ xúc xắc Might để trượt xuống.\n' +
        '5+  Bạn chủ động trượt xuống. Đặt nhân vật của bạn ở bất cứ phòng nào đã khám phá (căn phòng đích đến phải ở tầng phía dưới của căn phòng này).\n' +
        '0-4  Bạn trượt thẳng xuống tầng hầm. Rút một lát phòng tầng hầm và đặt nhân vật của bạn vào đó (Nếu không còn lát phòng tầng hầm nào thì chọn một phòng ở tầng hầm bất kì), chịu 1 xúc xắc sát thương vật lí.\n' +
        'Ở những lượt sau, người chơi vẫn có thể đổ xúc xắc Might để sử dụng "Slide".',
    },
    passToLeftIf: 'inBasement',
    discardIf: 'allPlayersInBasement',
    effect: 'placeToken',
    tokenType: 'slide',
    optional: true,
    rollStat: 'might',
    rollResults: [
      { range: '5+', effect: 'teleport', destination: 'anyDiscoveredRoomBelow' },
      { range: '0-4', effect: 'drawRoomTile', floor: 'basement', teleportTo: true, then: { effect: 'physicalDamage', dice: 1 } },
    ],
  },

  {
    id: 'con_bup_be_kinh_di',
    type: 'event',
    name: { vi: 'Con búp bê kinh dị' },
    text: {
      vi:
        'Bạn nhìn thấy một con búp bê nằm lăn lóc dưới sàn. Nó khiến bạn cảm thấy bất an. Bột nhiên, nó nhảy dựng dậy và cầm trên tay một cây giáo nhỏ.\n' +
        'Người chơi ở bên phải của bạn đổ 4 viên xúc xắc để đại diện cho sự tấn công của con búp bê lên bạn. Bạn phòng thủ bằng cách đổ xúc xắc Might như bình thường.\n' +
        'Nếu bạn bị gây sát thương bởi con búp bê, thì người chơi nào đang giữ lá bài Ngọn giáo (Spear - lá Omen) sẽ được tăng 2 Might (nếu bạn là người giữ lá bài Ngọn giáo, không có gì xảy ra).',
    },
    effect: 'attack',
    attackerDice: 4,
    attackerIsRightPlayer: true,
    defenderStat: 'might',
    onDamage: {
      condition: { otherPlayerHas: 'spear' },
      effect: 'gainStat',
      stat: 'might',
      amount: 2,
      target: 'spearHolder',
    },
  },

  {
    id: 'tang_le',
    type: 'event',
    name: { vi: 'Tang lễ' },
    text: {
      vi:
        'Bạn thấy một cái quan tài đang mở. Bạn đang nằm trong đó!!!\n' +
        'Bạn phải đổ xúc xắc Sanity:\n' +
        '4+  Bạn chớp mắt, thì ra chỉ là ảo ảnh. Tăng 1 Sanity.\n' +
        '2-3  Bạn hoảng sợ. Mất 1 Sanity.\n' +
        '0-1  Bạn thật sự đang ở trong quan tài. Mất 1 Sanity và 1 Might. Nếu Nghĩa địa hoặc Hầm mộ (Graveyard, Crypt) đã được tìm thấy thì đặt nhân vật của bạn vào 1 trong 2 căn phòng đó (bạn tự chọn).',
    },
    immediateRoll: true,
    rollStat: 'sanity',
    rollResults: [
      { range: '4+', effect: 'gainStat', stat: 'sanity', amount: 1 },
      { range: '2-3', effect: 'loseStat', stat: 'sanity', amount: 1 },
      {
        range: '0-1',
        effect: 'loseStats',
        stats: { sanity: 1, might: 1 },
        then: { effect: 'teleportIfExists', destinations: ['graveyard', 'crypt'] },
      },
    ],
  },

  {
    id: 'tieng_vay_goi',
    type: 'event',
    name: { vi: 'Tiếng vẫy gọi' },
    text: {
      vi:
        'Bên ngoài. Mày phải ra ngoài. Bay ra ngoài để được tự do!\n' +
        'Mỗi người chơi ở trong Khu vườn, Nghĩa địa, Tòa tháp, Ban công (Gardens, Graveyard, Tower, Balcony) hoặc trong căn phòng có cửa sổ nối với bên ngoài ngôi nhà phải đổ xúc xắc Sanity:\n' +
        '3+  Bạn tỉnh dậy kịp lúc.\n' +
        '0-2  Bạn nhảy ra Sân (Patio) (nếu chưa khám phá ra Sân (Patio), tìm nó ở trong chồng lát phòng và đặt vào chỗ bất kì trong ngôi nhà). Đặt nhân vật của bạn ở đó và chịu 1 xúc xắc sát thương vật lí.',
    },
    affectsAllPlayers: true,
    affectedRooms: ['gardens', 'graveyard', 'tower', 'balcony'],
    affectedRoomCondition: 'hasOutdoorWindow',
    rollStat: 'sanity',
    rollResults: [
      { range: '3+', effect: 'nothing' },
      { range: '0-2', effect: 'teleportToRoom', room: 'patio', createIfNotExists: true, then: { effect: 'physicalDamage', dice: 1 } },
    ],
  },
];

export const OMENS = [
  {
    id: 'vet_can',
    type: 'omen',
    name: { vi: 'Vết cắn' },
    text: {
      vi:
        'Một tiếng gầm gừ trong bóng tối, nặng mùi của cái chết và sự đau đớn.\n' +
        'Khi rút được lá bài này, một con gì đó đã cắn bạn. Người chơi ở bên tay phải bạn phải đổ 4 viên xúc xắc để tính sát thương gây ra lên bạn. Bạn phòng thủ bằng cách đổ xúc xắc Might.\n' +
        'Lá Omen này không thể bị đánh rơi, trao đổi hoặc bị cướp.',
    },
    onDraw: {
      effect: 'attack',
      attackerDice: 4,
      attackerIsRightPlayer: true,
      defenderStat: 'might',
    },
    cannotDrop: true,
    cannotTrade: true,
    cannotSteal: true,
  },

  {
    id: 'mat_na',
    type: 'omen',
    name: { vi: 'Mặt nạ' },
    text: {
      vi:
        'Một chiếc mặt nạ tuyệt vời để ẩn giấu suy nghĩ.\n' +
        'Một lần trong lượt, bạn có thể đổ xúc xắc Sanity để sử dụng mặt nạ:\n' +
        '4+  Bạn đeo hoặc tháo Mặt nạ.\n' +
        'Nếu bạn đeo Mặt nạ, tăng 2 Knowledge và giảm 2 Sanity.\n' +
        'Nếu bạn tháo Mặt nạ, giảm 2 Knowledge và tăng 2 Sanity.\n' +
        '0-3  Bạn không thể sử dụng Mặt nạ.',
    },
    usable: true,
    usePerTurn: 1,
    rollStat: 'sanity',
    rollResults: [
      {
        range: '4+',
        effect: 'toggle',
        onEquip: { gainStats: { knowledge: 2 }, loseStats: { sanity: 2 } },
        onUnequip: { loseStats: { knowledge: 2 }, gainStats: { sanity: 2 } },
      },
      { range: '0-3', effect: 'nothing' },
    ],
  },

  {
    id: 'chiec_nhan',
    type: 'omen',
    name: { vi: 'Chiếc nhẫn' },
    text: {
      vi:
        'Một chiếc nhẫn bị đập nát với dòng chữ khó hiểu.\n' +
        'Nếu tấn công đối thủ có chỉ số Sanity, bạn có thể dùng Sanity thay vì Might (đối thủ cũng phải phòng thủ bằng Sanity và bị sát thương tinh thần thay cho sát thương vật lí).',
    },
    passive: true,
    combatModifier: {
      canUseSanityInsteadOfMight: true,
      condition: 'enemyHasSanity',
      defenderUsesSanity: true,
      damageType: 'mental',
    },
  },

  {
    id: 'quyen_sach',
    type: 'omen',
    name: { vi: 'Quyển sách' },
    text: {
      vi:
        'Một quyển nhật kí hay bản ghi chú? Chữ viết cổ hay kí hiệu hiện đại?\n' +
        'Tăng 2 Knowledge.\n' +
        'Giảm 2 Knowledge nếu bạn mất Quyển sách.',
    },
    onGain: { effect: 'gainStat', stat: 'knowledge', amount: 2 },
    onLose: { effect: 'loseStat', stat: 'knowledge', amount: 2 },
  },

  {
    id: 'co_gai',
    type: 'omen',
    subtype: 'companion',
    name: { vi: 'Cô gái' },
    text: {
      vi:
        '(Bạn đồng hành)\n' +
        'Một cô gái sao? Đây là cái bẫy? Bỏ cô ta một mình hay cứu giúp?\n' +
        'Bạn tìm thấy một cô gái, bạn cho cô ta đi theo mình.\n' +
        'Tăng 1 Sanity và 1 Knowledge.\n' +
        'Giảm 1 Sanity và 1 Knowledge nếu bạn mất dấu cô gái.\n' +
        'Lá Omen này không thể bị đánh rơi, trao đổi hoặc bị cướp.',
    },
    onGain: { effect: 'gainStats', stats: { sanity: 1, knowledge: 1 } },
    onLose: { effect: 'loseStats', stats: { sanity: 1, knowledge: 1 } },
    cannotDrop: true,
    cannotTrade: true,
    cannotSteal: true,
  },

  {
    id: 'qua_cau_pha_le',
    type: 'omen',
    name: { vi: 'Quả cầu pha lê' },
    text: {
      vi:
        'Những cảnh tượng mờ ám hiện lên bên trong.\n' +
        'Một lần một lượt sau khi lời nguyền xuất hiện, bạn có thể đổ xúc xắc Knowledge để nhìn vào Quả cầu pha lê:\n' +
        '4+  Bạn nhìn thấy sự thật. Chọn một lá bất kì trong xấp bài Event hoặc Item, xào lại sắp bài và đặt lá bạn chọn lên đầu.\n' +
        '1-3  Bạn bị lóa mắt. Mất 1 Sanity.\n' +
        '0  Bạn nhìn thấy cảnh tượng ở địa ngục, bạn sợ hãi và mất 2 Sanity.',
    },
    usable: true,
    usePerTurn: 1,
    useAfterHaunt: true,
    rollStat: 'knowledge',
    rollResults: [
      { range: '4+', effect: 'searchDeck', decks: ['event', 'item'], placeOnTop: true },
      { range: '1-3', effect: 'loseStat', stat: 'sanity', amount: 1 },
      { range: '0', effect: 'loseStat', stat: 'sanity', amount: 2 },
    ],
  },

  {
    id: 'con_cho',
    type: 'omen',
    subtype: 'companion',
    name: { vi: 'Con chó' },
    text: {
      vi:
        '(Bạn đồng hành)\n' +
        'Con chó ghẻ này có vẻ thân thiện. Ít nhất là bạn nghĩ thế.\n' +
        'Tăng 1 Might và 1 Sanity.\n' +
        'Mất 1 Might và 1 Sanity nếu bạn mất dấu Con chó.\n' +
        'Lấy một miếng token để tượng trưng cho Con chó. Đặt nó cùng phòng với bạn.\n' +
        'Một lần trong lượt, Con chó có thể di chuyển tối đa 6 bước đến các căn phòng đã khám phá, sử dụng cửa, cầu thang và sau đó tự động quay trở lại. Nó có thể nhặt, mang và bỏ lại vật phẩm trước khi quay lại.\n' +
        'Con chó không bị làm chậm bởi đối thủ. Nó không thể dùng cửa bí mật, đi vào căn phòng có hiệu ứng đổ xúc xắc và mang vật phẩm có hiệu ứng làm chậm.\n' +
        'Lá Omen này không thể bị đánh rơi, trao đổi hoặc bị cướp.',
    },
    onGain: { effect: 'gainStats', stats: { might: 1, sanity: 1 } },
    onLose: { effect: 'loseStats', stats: { might: 1, sanity: 1 } },
    companion: {
      token: 'dog',
      movePerTurn: 6,
      canPickupItems: true,
      cannotBeSlowed: true,
      cannotUseSecretDoors: true,
      cannotEnterRollRooms: true,
      cannotCarrySlowItems: true,
    },
    cannotDrop: true,
    cannotTrade: true,
    cannotSteal: true,
  },

  {
    id: 'dau_lau',
    type: 'omen',
    name: { vi: 'Đầu lâu' },
    text: {
      vi:
        'Một cái đầu lâu bị nứt vỡ và thiếu mất vài cái răng.\n' +
        'Nếu nhận sát thương tinh thần, bạn có thể chuyển toàn bộ sang sát thương vật lí.',
    },
    passive: true,
    damageConversion: {
      from: 'mental',
      to: 'physical',
      optional: true,
    },
  },

  {
    id: 'tam_me_day',
    type: 'omen',
    name: { vi: 'Tấm mề đay' },
    text: {
      vi:
        'Một tấm mề đay được khắc hình ngôi sao năm cánh.\n' +
        'Bạn được miễn nhiễm với mọi hiệu ứng của Căn phòng hình sao, Nhà mồ và Nghĩa địa (Pentagram Chamber, Crypt và Graveyard).',
    },
    passive: true,
    immunity: ['pentagram_chamber', 'crypt', 'graveyard'],
  },

  {
    id: 'ngon_giao',
    type: 'omen',
    subtype: 'weapon',
    name: { vi: 'Ngọn giáo' },
    text: {
      vi:
        '(Vũ khí)\n' +
        'Một thứ vũ khí tăng sức mạnh.\n' +
        'Bạn được đổ nhiều hơn 2 viên xúc xắc (tối đa 8 viên) khi tấn công bằng Might với vũ khí này.\n' +
        'Bạn không thể sử dụng vũ khí khác cùng lúc với Ngọn giáo.',
    },
    weapon: true,
    combatBonus: {
      stat: 'might',
      extraDice: 2,
      maxDice: 8,
    },
    exclusiveWeapon: true,
  },

  {
    id: 'thanh_gia',
    type: 'omen',
    name: { vi: 'Thánh giá' },
    text: {
      vi:
        'Biểu tượng của cái thiện trong thế giới hỗn độn.\n' +
        'Tăng 2 Sanity.\n' +
        'Giảm 2 Sanity nếu bạn mất Thánh giá.',
    },
    onGain: { effect: 'gainStat', stat: 'sanity', amount: 2 },
    onLose: { effect: 'loseStat', stat: 'sanity', amount: 2 },
  },

  {
    id: 'ten_dien',
    type: 'omen',
    subtype: 'companion',
    name: { vi: 'Tên điên' },
    text: {
      vi:
        '(Bạn đồng hành)\n' +
        'Một tên điên nói nhảng nói cuội, miệng sùi bọt mép.\n' +
        'Tăng 2 Might và mất 1 Sanity.\n' +
        'Mất 2 Might và tăng 1 Sanity nếu bạn mất dấu kẻ điên.\n' +
        'Lá Omen này không thể bị đánh rơi, trao đổi hoặc bị cướp.',
    },
    onGain: { effect: 'modifyStats', gainStats: { might: 2 }, loseStats: { sanity: 1 } },
    onLose: { effect: 'modifyStats', loseStats: { might: 2 }, gainStats: { sanity: 1 } },
    cannotDrop: true,
    cannotTrade: true,
    cannotSteal: true,
  },

  {
    id: 'ban_cau_co',
    type: 'omen',
    name: { vi: 'Bàn cầu cơ' },
    text: {
      vi:
        'Một tấm bảng với những kí tự và con số kêu gọi cái chết.\n' +
        'Trước khi di chuyển trong lượt, bạn có thể nhìn trước lát phòng định rút.\n' +
        'Vì bàn cầu cơ thu hút ma quỷ, nên nếu bạn sử dụng Bàn cầu cơ sau khi lời nguyền xuất hiện, các quái vật có thể được đi nhiều hơn 1 bước về gần bạn hơn (nếu bạn là kẻ phản bội, không có gì xảy ra).',
    },
    usable: true,
    useBeforeMove: true,
    effect: 'peekRoomTile',
    afterHauntPenalty: {
      condition: 'notTraitor',
      effect: 'monstersMove',
      extraSteps: 1,
      towards: 'user',
    },
  },
];