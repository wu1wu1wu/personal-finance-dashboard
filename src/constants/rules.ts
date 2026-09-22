// ============================================================
// 内置分类规则 - 关键词 → 分类映射
// ============================================================

import type { ClassificationRule } from '@/types';

/** 内置分类规则（多数优先级 10，「其他」兜底优先级 5；用户自定义规则优先级 100+） */
export const BUILTIN_RULES: ClassificationRule[] = [
  // 餐饮美食
  {
    id: 'rule-dining-1',
    keywords: ['美团', '饿了么', '肯德基', '麦当劳', '星巴克', '瑞幸', '奶茶', '火锅', '烧烤', '烤肉', '自助餐', '外卖', '餐厅', '饭馆', '食堂', '小吃', '快餐', '咖啡', '饮品', '甜品', '面包', '蛋糕', '池奈', '詹记', '仟吉', '塔斯汀', '古茗', '饭团', '果园', '副食', '首义学院', '零食', '姜胖胖'],
    category: '餐饮美食',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 交通出行
  {
    id: 'rule-transport-1',
    keywords: ['滴滴', '高德', '地铁', '公交', '出租车', '加油', '停车', '高速', '铁路', '12306', '航空', '携程', '去哪儿', '飞猪', '打车', '共享单车', '哈啰', '青桔', '驴充充', '充电', '铁旅科技'],
    category: '交通出行',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 购物消费
  {
    id: 'rule-shopping-1',
    keywords: ['淘宝', '京东', '拼多多', '天猫', '苏宁', '唯品会', '超市', '便利店', '商场', '网购', '快递', '顺丰', '中通', '圆通', '韵达', '小黑盒', '抖音', '特产'],
    category: '购物消费',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 休闲娱乐
  {
    id: 'rule-entertainment-1',
    keywords: ['电影', '游戏', 'KTV', '酒吧', '旅游', '门票', '景区', '健身', '瑜伽', '游泳', '视频会员', '音乐会员', '腾讯视频', '爱奇艺', 'B站', '网易云音乐', 'QQ音乐', 'QQ', '自动续费'],
    category: '休闲娱乐',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 居住生活
  {
    id: 'rule-living-1',
    keywords: ['房租', '物业', '水电', '燃气', '宽带', '话费', '充值', '移动', '联通', '电信', '装修', '家具', '家电', '日用', '用水', '电费', '佳源科技'],
    category: '居住生活',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 医疗健康
  {
    id: 'rule-health-1',
    keywords: ['医院', '药房', '体检', '保险', '社保', '医保', '诊所', '牙科', '眼科', '药品'],
    category: '医疗健康',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 教育学习
  {
    id: 'rule-education-1',
    keywords: ['学费', '培训', '课程', '书籍', '考试', '学校', '教育', '网课', '得到', '极客时间', '知网', '图书馆', 'DeepSeek', '深度求索', '打印'],
    category: '教育学习',
    priority: 10,
    isCustom: false,
    hitCount: 0,
  },
  // 转账 - 资金搬运（转账/红包/提现/退款/还款），与真实消费区分开
  {
    id: 'rule-transfer-1',
    keywords: ['转账', '红包', '提现', '退款', '还款', '信用卡还款'],
    category: '转账',
    // 优先级高于消费类：账单里交易类型明确写着「转账/红包」的，就该归转账
    priority: 12,
    isCustom: false,
    hitCount: 0,
  },
  // 其他 - 银行费用类
  {
    id: 'rule-other-1',
    keywords: ['手续费', '利息'],
    category: '其他',
    priority: 5,
    isCustom: false,
    hitCount: 0,
  },

  // ===== 真实账单补充词表 =====
  // 微信账单里的商户名常常只有店招（如「武汉市尚酥坊点心店」），
  // 早期词表覆盖不到，这里按业态补一批高频词。
  // 优先级设为 9，低于上面的通用规则，避免抢走本该归类的交易。
  {
    id: 'rule-dining-2',
    keywords: ['点心', '糕点', '面包', '烘焙', '甜品', '早餐', '早点', '小吃', '食府', '菜馆', '饭庄', '卤味', '烤肉', '火锅', '川菜', '湘菜', '粤菜', '面馆', '粉店', '汤包', '包子', '煎饼', '烧烤', '零食', '水果', '生鲜', '食品'],
    category: '餐饮美食',
    priority: 9,
    isCustom: false,
    hitCount: 0,
  },
  {
    id: 'rule-transport-2',
    keywords: ['骑安', '乘车', '拼车', '顺风车', '停车', '高速', '加油', '充电桩', '共享单车', '公交', '轻轨', '高铁', '火车'],
    category: '交通出行',
    priority: 9,
    isCustom: false,
    hitCount: 0,
  },
  {
    id: 'rule-shopping-2',
    keywords: ['丰巢', '快件', '畅存', '驿站', '菜鸟', '代收', '寄存', '超市', '便利店', '百货', '商场', '专卖店'],
    category: '购物消费',
    priority: 9,
    isCustom: false,
    hitCount: 0,
  },
  {
    id: 'rule-living-2',
    keywords: ['物业', '水电', '燃气', '宽带', '话费', '房租', '家政', '保洁', '维修'],
    category: '居住生活',
    priority: 9,
    isCustom: false,
    hitCount: 0,
  },
  {
    id: 'rule-health-2',
    keywords: ['门诊', '挂号', '体检', '诊所', '口腔', '牙科', '眼科', '验光'],
    category: '医疗健康',
    priority: 9,
    isCustom: false,
    hitCount: 0,
  },
  {
    id: 'rule-entertainment-2',
    keywords: ['健身', '游泳', '球馆', '桌游', '密室', '剧本杀', '展览', '演出', '话剧', '音乐会', '网吧'],
    category: '休闲娱乐',
    priority: 9,
    isCustom: false,
    hitCount: 0,
  },
];
