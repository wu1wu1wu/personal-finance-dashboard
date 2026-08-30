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
  // 其他 - 转账/红包等
  {
    id: 'rule-other-1',
    keywords: ['转账', '红包', '提现', '退款', '手续费', '利息'],
    category: '其他',
    priority: 5,
    isCustom: false,
    hitCount: 0,
  },
];