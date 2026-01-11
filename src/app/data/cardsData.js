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
        'Nếu người sử dụng bị thôi miên thì sẽ đánh rơi hộp nhạc. Nếu bị rơi, hộp nhạc vẫn sẽ giữ nguyên tình trạng đóng/ mở trước đó.',
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
  },

  {
    id: 'dao_gam_hut_mau',
    type: 'item',
    name: { vi: 'Dao găm hút máu' },
    text: {
      vi:
        'Một thứ vũ khí kinh tởm. Những cái kim và vòi mọc ra từ cán đâm vào mạch máu ở tay bạn.\n' +
        'Bạn có thể đổ nhiều hơn 3 viên xúc xắc (tối đa là 8 viên) khi chiến đấu bằng Might với vũ khí này, nhưng đổi lại bạn phải mất 1 Speed mỗi lần sử dụng.\n' +
        'Bạn không thể sử dụng vũ khí khác cùng lúc với vũ khí này.\n' +
        'Item này không thể trao đổi hay đánh rơi. Nếu nó bị cướp, bạn chịu 2 xúc xắc sát thương vật lí.',
    },
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
  },
];