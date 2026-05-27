const items = [
  {
    id: 'report',
    category: '报到',
    title: '新生报到流程',
    summary: '录取通知书、身份证、团学档案、宿舍办理等事项先按学校正式通知核对。',
    body: '深汕校区首年信息以学校招生网和学院通知为准。到校前建议准备身份证、录取通知书、个人证件照、团员档案、银行卡或移动支付工具，报到当天按现场指引完成身份核验、宿舍入住和校园卡/网络相关手续。',
    tags: ['待学校确认', '开学必看'],
    url: 'https://zhaosheng.szpu.edu.cn/',
    updatedAt: '2026-05',
    status: '待学校确认'
  },
  {
    id: 'dorm',
    category: '宿舍',
    title: '宿舍入住清单',
    summary: '床品、洗漱、插排、常用药和证件资料优先准备。',
    body: '建议先准备床品、洗漱用品、衣架、收纳、拖鞋、常用药、雨具、充电器、少量现金和证件资料。大件生活用品可以到校后根据宿舍实际尺寸再购买。',
    tags: ['入住', '生活'],
    updatedAt: '2026-05',
    status: '通用建议'
  },
  {
    id: 'traffic',
    category: '交通',
    title: '到校交通',
    summary: '正式路线、接驳安排和报到点以学校开学通知为准。',
    body: '深汕校区到校路线建议以学校官网、招生网和录取通知书内说明为准。开学前可以把高铁站、汽车站、校区门口、宿舍区位置加入收藏，等学校发布接驳通知后再更新。',
    tags: ['待学校确认', '路线'],
    url: 'https://www.szpu.edu.cn/',
    updatedAt: '2026-05',
    status: '待学校确认'
  },
  {
    id: 'map',
    category: '地图',
    title: '楼栋位置',
    summary: '教学楼、宿舍楼、食堂、快递点等位置后续按实地信息更新。',
    body: '第一版先记录教学楼、宿舍楼、食堂、快递点、医务室、运动场等常用点位。等灰度测试同学到校后，可补充更准确的文字路线。',
    tags: ['校区导航'],
    updatedAt: '2026-05',
    status: '待实地更新'
  },
  {
    id: 'wifi',
    category: '网络',
    title: '校园 WiFi 与网络',
    summary: '账号开通、宿舍网络和常见问题等学校发布后补齐。',
    body: '校园网通常涉及统一身份账号、运营商套餐或学校网络服务。当前先保留入口，等信息中心或迎新手册发布正式说明后更新。',
    tags: ['待学校确认'],
    url: 'https://www.szpu.edu.cn/xs.htm',
    updatedAt: '2026-05',
    status: '待学校确认'
  },
  {
    id: 'official',
    category: '官网',
    title: '常用官网入口',
    summary: '学校官网、学生入口、教务处、招生信息网。',
    body: '常用入口：深圳职业技术大学官网、学生入口、教务处、本科/专科教务系统、招生信息网。涉及课表、考试、通知的内容优先看官方渠道。',
    tags: ['官网', '教务'],
    links: [
      { label: '学校官网', url: 'https://www.szpu.edu.cn/' },
      { label: '学生入口', url: 'https://www.szpu.edu.cn/xs.htm' },
      { label: '教务处', url: 'https://jiaowc.szpu.edu.cn/' },
      { label: '招生信息网', url: 'https://zhaosheng.szpu.edu.cn/' }
    ],
    updatedAt: '2026-05',
    status: '公开信息'
  }
]

const categories = ['全部', '报到', '宿舍', '交通', '地图', '网络', '官网']

module.exports = {
  categories,
  items
}
