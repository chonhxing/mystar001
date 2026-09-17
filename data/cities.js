/**
 * 中国地区（三级：省级 → 市级 → 区/县）。
 *
 * ## 关于精度的一点说明
 *
 * 出生地在这个产品里**只有一个用途**：估算上升星座。而经度差 1 度 ≈ 4 分钟时差，
 * 换算到上升星座上几乎看不出来（上升每 2 小时才走一个星座）。
 * 所以**市级经纬度已经远超实际需要**，第三级的区县只影响选择体验，不参与精度。
 *
 * 因此这里的数据策略是：
 *   - **省级 / 市级**：完整且带经纬度（34 个省级行政区，含直辖市、港澳台）
 *   - **区/县级**：只给主要城市列明细；没列的城市回退成「市辖区」
 *     （`districtsOf()` 负责兜底，不用在每个城市上重复写）
 *
 * 想补某个城市的区县：给它加个 `districts` 数组即可，其它代码不用动。
 */

// ---------------------------------------------------------------- 数据

const PROVINCES = [
  {
    name: '北京',
    type: '直辖市',
    cities: [
      {
        name: '北京', lng: 116.41, lat: 39.90,
        districts: ['东城区', '西城区', '朝阳区', '海淀区', '丰台区', '石景山区', '通州区', '昌平区', '大兴区', '顺义区', '房山区', '门头沟区', '怀柔区', '平谷区', '密云区', '延庆区']
      }
    ]
  },
  {
    name: '天津',
    type: '直辖市',
    cities: [
      {
        name: '天津', lng: 117.20, lat: 39.13,
        districts: ['和平区', '河东区', '河西区', '南开区', '河北区', '红桥区', '滨海新区', '东丽区', '西青区', '津南区', '北辰区', '武清区', '宝坻区', '宁河区', '静海区', '蓟州区']
      }
    ]
  },
  {
    name: '上海',
    type: '直辖市',
    cities: [
      {
        name: '上海', lng: 121.47, lat: 31.23,
        districts: ['黄浦区', '徐汇区', '长宁区', '静安区', '普陀区', '虹口区', '杨浦区', '浦东新区', '闵行区', '宝山区', '嘉定区', '金山区', '松江区', '青浦区', '奉贤区', '崇明区']
      }
    ]
  },
  {
    name: '重庆',
    type: '直辖市',
    cities: [
      {
        name: '重庆', lng: 106.55, lat: 29.56,
        districts: ['渝中区', '江北区', '南岸区', '沙坪坝区', '九龙坡区', '大渡口区', '渝北区', '巴南区', '北碚区', '万州区', '涪陵区', '永川区', '合川区', '江津区', '长寿区', '綦江区']
      }
    ]
  },

  // ================= 华北 =================
  {
    name: '河北',
    type: '省',
    cities: [
      { name: '石家庄', lng: 114.51, lat: 38.04 },
      { name: '唐山', lng: 118.18, lat: 39.63 },
      { name: '秦皇岛', lng: 119.60, lat: 39.94 },
      { name: '邯郸', lng: 114.54, lat: 36.63 },
      { name: '邢台', lng: 114.51, lat: 37.07 },
      { name: '保定', lng: 115.46, lat: 38.87 },
      { name: '张家口', lng: 114.88, lat: 40.82 },
      { name: '承德', lng: 117.96, lat: 40.95 },
      { name: '沧州', lng: 116.84, lat: 38.30 },
      { name: '廊坊', lng: 116.68, lat: 39.54 },
      { name: '衡水', lng: 115.67, lat: 37.74 }
    ]
  },
  {
    name: '山西',
    type: '省',
    cities: [
      { name: '太原', lng: 112.55, lat: 37.87 },
      { name: '大同', lng: 113.30, lat: 40.08 },
      { name: '阳泉', lng: 113.58, lat: 37.86 },
      { name: '长治', lng: 113.12, lat: 36.19 },
      { name: '晋城', lng: 112.85, lat: 35.50 },
      { name: '朔州', lng: 112.43, lat: 39.33 },
      { name: '晋中', lng: 112.75, lat: 37.69 },
      { name: '运城', lng: 111.00, lat: 35.02 },
      { name: '忻州', lng: 112.73, lat: 38.42 },
      { name: '临汾', lng: 111.51, lat: 36.08 },
      { name: '吕梁', lng: 111.13, lat: 37.52 }
    ]
  },
  {
    name: '内蒙古',
    type: '自治区',
    cities: [
      { name: '呼和浩特', lng: 111.75, lat: 40.84 },
      { name: '包头', lng: 109.84, lat: 40.66 },
      { name: '乌海', lng: 106.79, lat: 39.65 },
      { name: '赤峰', lng: 118.96, lat: 42.26 },
      { name: '通辽', lng: 122.24, lat: 43.65 },
      { name: '鄂尔多斯', lng: 109.78, lat: 39.61 },
      { name: '呼伦贝尔', lng: 119.77, lat: 49.21 },
      { name: '巴彦淖尔', lng: 107.39, lat: 40.75 },
      { name: '乌兰察布', lng: 113.13, lat: 40.99 }
    ]
  },

  // ================= 东北 =================
  {
    name: '辽宁',
    type: '省',
    cities: [
      { name: '沈阳', lng: 123.43, lat: 41.80 },
      { name: '大连', lng: 121.62, lat: 38.91 },
      { name: '鞍山', lng: 122.99, lat: 41.11 },
      { name: '抚顺', lng: 123.96, lat: 41.88 },
      { name: '本溪', lng: 123.77, lat: 41.30 },
      { name: '丹东', lng: 124.35, lat: 40.00 },
      { name: '锦州', lng: 121.13, lat: 41.10 },
      { name: '营口', lng: 122.24, lat: 40.67 },
      { name: '盘锦', lng: 122.07, lat: 41.12 },
      { name: '辽阳', lng: 123.24, lat: 41.27 },
      { name: '葫芦岛', lng: 120.84, lat: 40.71 }
    ]
  },
  {
    name: '吉林',
    type: '省',
    cities: [
      { name: '长春', lng: 125.32, lat: 43.82 },
      { name: '吉林', lng: 126.55, lat: 43.84 },
      { name: '四平', lng: 124.35, lat: 43.17 },
      { name: '辽源', lng: 125.14, lat: 42.89 },
      { name: '通化', lng: 125.94, lat: 41.73 },
      { name: '白山', lng: 126.42, lat: 41.94 },
      { name: '松原', lng: 124.82, lat: 45.14 },
      { name: '白城', lng: 122.84, lat: 45.62 },
      { name: '延边', lng: 129.51, lat: 42.89 }
    ]
  },
  {
    name: '黑龙江',
    type: '省',
    cities: [
      { name: '哈尔滨', lng: 126.53, lat: 45.80 },
      { name: '齐齐哈尔', lng: 123.96, lat: 47.35 },
      { name: '鸡西', lng: 130.97, lat: 45.30 },
      { name: '鹤岗', lng: 130.30, lat: 47.35 },
      { name: '双鸭山', lng: 131.16, lat: 46.65 },
      { name: '大庆', lng: 125.10, lat: 46.59 },
      { name: '伊春', lng: 128.90, lat: 47.73 },
      { name: '佳木斯', lng: 130.32, lat: 46.80 },
      { name: '牡丹江', lng: 129.60, lat: 44.55 },
      { name: '绥化', lng: 126.99, lat: 46.64 }
    ]
  },

  // ================= 华东 =================
  {
    name: '江苏',
    type: '省',
    cities: [
      {
        name: '南京', lng: 118.80, lat: 32.06,
        districts: ['玄武区', '秦淮区', '建邺区', '鼓楼区', '浦口区', '栖霞区', '雨花台区', '江宁区', '六合区', '溧水区', '高淳区']
      },
      { name: '无锡', lng: 120.31, lat: 31.49 },
      { name: '徐州', lng: 117.28, lat: 34.26 },
      { name: '常州', lng: 119.97, lat: 31.81 },
      {
        name: '苏州', lng: 120.62, lat: 31.32,
        districts: ['姑苏区', '虎丘区', '吴中区', '相城区', '吴江区', '昆山市', '常熟市', '张家港市', '太仓市']
      },
      { name: '南通', lng: 120.86, lat: 32.01 },
      { name: '连云港', lng: 119.16, lat: 34.60 },
      { name: '淮安', lng: 119.02, lat: 33.61 },
      { name: '盐城', lng: 120.16, lat: 33.35 },
      { name: '扬州', lng: 119.42, lat: 32.39 },
      { name: '镇江', lng: 119.45, lat: 32.20 },
      { name: '泰州', lng: 119.92, lat: 32.46 },
      { name: '宿迁', lng: 118.28, lat: 33.96 }
    ]
  },
  {
    name: '浙江',
    type: '省',
    cities: [
      {
        name: '杭州', lng: 120.15, lat: 30.27,
        districts: ['上城区', '拱墅区', '西湖区', '滨江区', '萧山区', '余杭区', '临平区', '钱塘区', '富阳区', '临安区', '桐庐县', '淳安县', '建德市']
      },
      { name: '宁波', lng: 121.55, lat: 29.87 },
      { name: '温州', lng: 120.70, lat: 28.00 },
      { name: '嘉兴', lng: 120.75, lat: 30.76 },
      { name: '湖州', lng: 120.09, lat: 30.89 },
      { name: '绍兴', lng: 120.58, lat: 30.01 },
      { name: '金华', lng: 119.65, lat: 29.08 },
      { name: '衢州', lng: 118.87, lat: 28.94 },
      { name: '舟山', lng: 122.21, lat: 29.99 },
      { name: '台州', lng: 121.42, lat: 28.66 },
      { name: '丽水', lng: 119.92, lat: 28.45 }
    ]
  },
  {
    name: '安徽',
    type: '省',
    cities: [
      { name: '合肥', lng: 117.23, lat: 31.82 },
      { name: '芜湖', lng: 118.43, lat: 31.35 },
      { name: '蚌埠', lng: 117.39, lat: 32.92 },
      { name: '淮南', lng: 117.00, lat: 32.63 },
      { name: '马鞍山', lng: 118.51, lat: 31.67 },
      { name: '淮北', lng: 116.80, lat: 33.96 },
      { name: '铜陵', lng: 117.82, lat: 30.94 },
      { name: '安庆', lng: 117.06, lat: 30.54 },
      { name: '黄山', lng: 118.34, lat: 29.71 },
      { name: '滁州', lng: 118.32, lat: 32.30 },
      { name: '阜阳', lng: 115.82, lat: 32.90 },
      { name: '宿州', lng: 116.98, lat: 33.63 },
      { name: '六安', lng: 116.52, lat: 31.74 },
      { name: '亳州', lng: 115.78, lat: 33.85 }
    ]
  },
  {
    name: '福建',
    type: '省',
    cities: [
      { name: '福州', lng: 119.30, lat: 26.08 },
      { name: '厦门', lng: 118.09, lat: 24.48 },
      { name: '莆田', lng: 119.01, lat: 25.43 },
      { name: '三明', lng: 117.64, lat: 26.27 },
      { name: '泉州', lng: 118.68, lat: 24.87 },
      { name: '漳州', lng: 117.65, lat: 24.51 },
      { name: '南平', lng: 118.18, lat: 26.64 },
      { name: '龙岩', lng: 117.02, lat: 25.08 },
      { name: '宁德', lng: 119.55, lat: 26.67 }
    ]
  },
  {
    name: '江西',
    type: '省',
    cities: [
      { name: '南昌', lng: 115.86, lat: 28.68 },
      { name: '景德镇', lng: 117.18, lat: 29.27 },
      { name: '萍乡', lng: 113.85, lat: 27.62 },
      { name: '九江', lng: 116.00, lat: 29.71 },
      { name: '新余', lng: 114.92, lat: 27.82 },
      { name: '鹰潭', lng: 117.07, lat: 28.26 },
      { name: '赣州', lng: 114.94, lat: 25.83 },
      { name: '吉安', lng: 114.99, lat: 27.11 },
      { name: '宜春', lng: 114.42, lat: 27.80 },
      { name: '抚州', lng: 116.36, lat: 27.95 },
      { name: '上饶', lng: 117.97, lat: 28.45 }
    ]
  },
  {
    name: '山东',
    type: '省',
    cities: [
      { name: '济南', lng: 117.00, lat: 36.65 },
      { name: '青岛', lng: 120.38, lat: 36.07 },
      { name: '淄博', lng: 118.05, lat: 36.81 },
      { name: '枣庄', lng: 117.32, lat: 34.81 },
      { name: '东营', lng: 118.67, lat: 37.43 },
      { name: '烟台', lng: 121.39, lat: 37.54 },
      { name: '潍坊', lng: 119.16, lat: 36.71 },
      { name: '济宁', lng: 116.59, lat: 35.41 },
      { name: '泰安', lng: 117.09, lat: 36.20 },
      { name: '威海', lng: 122.12, lat: 37.51 },
      { name: '日照', lng: 119.53, lat: 35.42 },
      { name: '临沂', lng: 118.36, lat: 35.10 },
      { name: '德州', lng: 116.36, lat: 37.44 },
      { name: '聊城', lng: 115.98, lat: 36.46 },
      { name: '滨州', lng: 117.97, lat: 37.38 },
      { name: '菏泽', lng: 115.48, lat: 35.23 }
    ]
  },

  // ================= 华中 =================
  {
    name: '河南',
    type: '省',
    cities: [
      { name: '郑州', lng: 113.63, lat: 34.75 },
      { name: '开封', lng: 114.31, lat: 34.80 },
      { name: '洛阳', lng: 112.45, lat: 34.62 },
      { name: '平顶山', lng: 113.19, lat: 33.77 },
      { name: '安阳', lng: 114.35, lat: 36.10 },
      { name: '鹤壁', lng: 114.30, lat: 35.75 },
      { name: '新乡', lng: 113.93, lat: 35.30 },
      { name: '焦作', lng: 113.24, lat: 35.22 },
      { name: '濮阳', lng: 115.03, lat: 35.76 },
      { name: '许昌', lng: 113.85, lat: 34.04 },
      { name: '漯河', lng: 114.02, lat: 33.58 },
      { name: '三门峡', lng: 111.20, lat: 34.77 },
      { name: '南阳', lng: 112.53, lat: 32.99 },
      { name: '商丘', lng: 115.66, lat: 34.41 },
      { name: '信阳', lng: 114.09, lat: 32.15 },
      { name: '周口', lng: 114.70, lat: 33.62 },
      { name: '驻马店', lng: 114.02, lat: 33.01 }
    ]
  },
  {
    name: '湖北',
    type: '省',
    cities: [
      {
        name: '武汉', lng: 114.30, lat: 30.59,
        districts: ['江岸区', '江汉区', '硚口区', '汉阳区', '武昌区', '青山区', '洪山区', '东西湖区', '汉南区', '蔡甸区', '江夏区', '黄陂区', '新洲区']
      },
      { name: '黄石', lng: 115.04, lat: 30.20 },
      { name: '十堰', lng: 110.80, lat: 32.63 },
      { name: '宜昌', lng: 111.29, lat: 30.69 },
      { name: '襄阳', lng: 112.12, lat: 32.01 },
      { name: '鄂州', lng: 114.89, lat: 30.39 },
      { name: '荆门', lng: 112.20, lat: 31.04 },
      { name: '孝感', lng: 113.92, lat: 30.93 },
      { name: '荆州', lng: 112.24, lat: 30.33 },
      { name: '黄冈', lng: 114.87, lat: 30.45 },
      { name: '咸宁', lng: 114.32, lat: 29.84 },
      { name: '随州', lng: 113.38, lat: 31.72 },
      { name: '恩施', lng: 109.49, lat: 30.28 }
    ]
  },
  {
    name: '湖南',
    type: '省',
    cities: [
      {
        name: '长沙', lng: 112.94, lat: 28.23,
        districts: ['芙蓉区', '天心区', '岳麓区', '开福区', '雨花区', '望城区', '长沙县', '浏阳市', '宁乡市']
      },
      { name: '株洲', lng: 113.13, lat: 27.83 },
      { name: '湘潭', lng: 112.94, lat: 27.83 },
      { name: '衡阳', lng: 112.57, lat: 26.89 },
      { name: '邵阳', lng: 111.47, lat: 27.24 },
      { name: '岳阳', lng: 113.13, lat: 29.36 },
      { name: '常德', lng: 111.69, lat: 29.05 },
      { name: '张家界', lng: 110.48, lat: 29.13 },
      { name: '益阳', lng: 112.36, lat: 28.55 },
      { name: '郴州', lng: 113.03, lat: 25.79 },
      { name: '永州', lng: 111.61, lat: 26.42 },
      { name: '怀化', lng: 110.00, lat: 27.57 },
      { name: '娄底', lng: 112.00, lat: 27.70 },
      { name: '湘西', lng: 109.74, lat: 28.31 }
    ]
  },

  // ================= 华南 =================
  {
    name: '广东',
    type: '省',
    cities: [
      {
        name: '广州', lng: 113.26, lat: 23.13,
        districts: ['越秀区', '荔湾区', '海珠区', '天河区', '白云区', '黄埔区', '番禺区', '花都区', '南沙区', '从化区', '增城区']
      },
      {
        name: '深圳', lng: 114.06, lat: 22.55,
        districts: ['福田区', '罗湖区', '南山区', '宝安区', '龙岗区', '盐田区', '龙华区', '坪山区', '光明区', '大鹏新区']
      },
      { name: '珠海', lng: 113.55, lat: 22.27 },
      { name: '汕头', lng: 116.68, lat: 23.35 },
      { name: '佛山', lng: 113.12, lat: 23.02 },
      { name: '韶关', lng: 113.60, lat: 24.81 },
      { name: '湛江', lng: 110.36, lat: 21.27 },
      { name: '肇庆', lng: 112.47, lat: 23.05 },
      { name: '江门', lng: 113.09, lat: 22.58 },
      { name: '茂名', lng: 110.93, lat: 21.66 },
      { name: '惠州', lng: 114.42, lat: 23.11 },
      { name: '梅州', lng: 116.12, lat: 24.30 },
      { name: '汕尾', lng: 115.36, lat: 22.79 },
      { name: '河源', lng: 114.70, lat: 23.74 },
      { name: '阳江', lng: 111.98, lat: 21.86 },
      { name: '清远', lng: 113.06, lat: 23.68 },
      { name: '东莞', lng: 113.75, lat: 23.02 },
      { name: '中山', lng: 113.39, lat: 22.52 },
      { name: '潮州', lng: 116.62, lat: 23.66 },
      { name: '揭阳', lng: 116.37, lat: 23.55 },
      { name: '云浮', lng: 112.04, lat: 22.92 }
    ]
  },
  {
    name: '广西',
    type: '自治区',
    cities: [
      { name: '南宁', lng: 108.37, lat: 22.82 },
      { name: '柳州', lng: 109.42, lat: 24.33 },
      { name: '桂林', lng: 110.29, lat: 25.27 },
      { name: '梧州', lng: 111.28, lat: 23.48 },
      { name: '北海', lng: 109.12, lat: 21.48 },
      { name: '防城港', lng: 108.35, lat: 21.69 },
      { name: '钦州', lng: 108.65, lat: 21.98 },
      { name: '贵港', lng: 109.60, lat: 23.11 },
      { name: '玉林', lng: 110.16, lat: 22.63 },
      { name: '百色', lng: 106.62, lat: 23.90 },
      { name: '贺州', lng: 111.55, lat: 24.40 },
      { name: '河池', lng: 108.06, lat: 24.70 },
      { name: '来宾', lng: 109.23, lat: 23.75 },
      { name: '崇左', lng: 107.36, lat: 22.40 }
    ]
  },
  {
    name: '海南',
    type: '省',
    cities: [
      { name: '海口', lng: 110.20, lat: 20.04 },
      { name: '三亚', lng: 109.51, lat: 18.25 },
      { name: '三沙', lng: 112.34, lat: 16.83 },
      { name: '儋州', lng: 109.58, lat: 19.52 },
      { name: '琼海', lng: 110.47, lat: 19.26 },
      { name: '文昌', lng: 110.80, lat: 19.55 },
      { name: '万宁', lng: 110.39, lat: 18.80 },
      { name: '东方', lng: 108.65, lat: 19.10 },
      { name: '五指山', lng: 109.52, lat: 18.78 }
    ]
  },
  {
    name: '香港',
    type: '特别行政区',
    cities: [
      {
        name: '香港', lng: 114.17, lat: 22.32,
        districts: ['中西区', '湾仔区', '东区', '南区', '油尖旺区', '深水埗区', '九龙城区', '黄大仙区', '观塘区', '葵青区', '荃湾区', '屯门区', '元朗区', '北区', '大埔区', '沙田区', '西贡区', '离岛区']
      }
    ]
  },
  {
    name: '澳门',
    type: '特别行政区',
    cities: [
      {
        name: '澳门', lng: 113.55, lat: 22.20,
        districts: ['花地玛堂区', '花王堂区', '望德堂区', '大堂区', '风顺堂区', '嘉模堂区', '圣方济各堂区', '路氹填海区']
      }
    ]
  },

  // ================= 西南 =================
  {
    name: '四川',
    type: '省',
    cities: [
      {
        name: '成都', lng: 104.07, lat: 30.67,
        districts: ['锦江区', '青羊区', '金牛区', '武侯区', '成华区', '龙泉驿区', '青白江区', '新都区', '温江区', '双流区', '郫都区', '新津区', '都江堰市', '彭州市', '邛崃市', '崇州市', '简阳市']
      },
      { name: '自贡', lng: 104.78, lat: 29.34 },
      { name: '攀枝花', lng: 101.72, lat: 26.58 },
      { name: '泸州', lng: 105.44, lat: 28.87 },
      { name: '德阳', lng: 104.40, lat: 31.13 },
      { name: '绵阳', lng: 104.68, lat: 31.47 },
      { name: '广元', lng: 105.84, lat: 32.44 },
      { name: '遂宁', lng: 105.59, lat: 30.53 },
      { name: '内江', lng: 105.06, lat: 29.58 },
      { name: '乐山', lng: 103.77, lat: 29.55 },
      { name: '南充', lng: 106.08, lat: 30.80 },
      { name: '眉山', lng: 103.85, lat: 30.08 },
      { name: '宜宾', lng: 104.63, lat: 28.77 },
      { name: '广安', lng: 106.63, lat: 30.46 },
      { name: '达州', lng: 107.50, lat: 31.21 },
      { name: '雅安', lng: 103.04, lat: 29.98 },
      { name: '巴中', lng: 106.75, lat: 31.87 },
      { name: '资阳', lng: 104.63, lat: 30.12 },
      { name: '阿坝', lng: 102.22, lat: 31.90 },
      { name: '甘孜', lng: 101.96, lat: 30.05 },
      { name: '凉山', lng: 102.27, lat: 27.88 }
    ]
  },
  {
    name: '贵州',
    type: '省',
    cities: [
      { name: '贵阳', lng: 106.63, lat: 26.65 },
      { name: '六盘水', lng: 104.83, lat: 26.59 },
      { name: '遵义', lng: 106.93, lat: 27.73 },
      { name: '安顺', lng: 105.93, lat: 26.25 },
      { name: '毕节', lng: 105.29, lat: 27.30 },
      { name: '铜仁', lng: 109.19, lat: 27.72 },
      { name: '黔西南', lng: 104.90, lat: 25.09 },
      { name: '黔东南', lng: 107.98, lat: 26.58 },
      { name: '黔南', lng: 107.52, lat: 26.26 }
    ]
  },
  {
    name: '云南',
    type: '省',
    cities: [
      {
        name: '昆明', lng: 102.83, lat: 24.88,
        districts: ['五华区', '盘龙区', '官渡区', '西山区', '东川区', '呈贡区', '晋宁区', '安宁市', '富民县', '宜良县']
      },
      { name: '曲靖', lng: 103.80, lat: 25.49 },
      { name: '玉溪', lng: 102.54, lat: 24.35 },
      { name: '保山', lng: 99.17, lat: 25.11 },
      { name: '昭通', lng: 103.72, lat: 27.34 },
      { name: '丽江', lng: 100.23, lat: 26.86 },
      { name: '普洱', lng: 100.97, lat: 22.83 },
      { name: '临沧', lng: 100.09, lat: 23.89 },
      { name: '楚雄', lng: 101.55, lat: 25.04 },
      { name: '红河', lng: 103.38, lat: 23.37 },
      { name: '文山', lng: 104.24, lat: 23.37 },
      { name: '西双版纳', lng: 100.80, lat: 22.01 },
      { name: '大理', lng: 100.23, lat: 25.60 },
      { name: '德宏', lng: 98.58, lat: 24.44 },
      { name: '怒江', lng: 98.86, lat: 25.85 },
      { name: '迪庆', lng: 99.71, lat: 27.83 }
    ]
  },
  {
    name: '西藏',
    type: '自治区',
    cities: [
      { name: '拉萨', lng: 91.14, lat: 29.65 },
      { name: '日喀则', lng: 88.88, lat: 29.27 },
      { name: '昌都', lng: 97.17, lat: 31.14 },
      { name: '林芝', lng: 94.36, lat: 29.65 },
      { name: '山南', lng: 91.77, lat: 29.24 },
      { name: '那曲', lng: 92.06, lat: 31.48 },
      { name: '阿里', lng: 80.11, lat: 32.50 }
    ]
  },

  // ================= 西北 =================
  {
    name: '陕西',
    type: '省',
    cities: [
      {
        name: '西安', lng: 108.94, lat: 34.34,
        districts: ['新城区', '碑林区', '莲湖区', '雁塔区', '灞桥区', '未央区', '阎良区', '临潼区', '长安区', '高陵区', '鄠邑区', '蓝田县', '周至县']
      },
      { name: '铜川', lng: 108.95, lat: 34.89 },
      { name: '宝鸡', lng: 107.14, lat: 34.36 },
      { name: '咸阳', lng: 108.71, lat: 34.33 },
      { name: '渭南', lng: 109.51, lat: 34.50 },
      { name: '延安', lng: 109.49, lat: 36.60 },
      { name: '汉中', lng: 107.03, lat: 33.07 },
      { name: '榆林', lng: 109.73, lat: 38.29 },
      { name: '安康', lng: 109.03, lat: 32.68 },
      { name: '商洛', lng: 109.94, lat: 33.87 }
    ]
  },
  {
    name: '甘肃',
    type: '省',
    cities: [
      { name: '兰州', lng: 103.83, lat: 36.06 },
      { name: '嘉峪关', lng: 98.29, lat: 39.77 },
      { name: '金昌', lng: 102.19, lat: 38.52 },
      { name: '白银', lng: 104.14, lat: 36.55 },
      { name: '天水', lng: 105.72, lat: 34.58 },
      { name: '武威', lng: 102.64, lat: 37.93 },
      { name: '张掖', lng: 100.46, lat: 38.93 },
      { name: '平凉', lng: 106.68, lat: 35.54 },
      { name: '酒泉', lng: 98.51, lat: 39.74 },
      { name: '庆阳', lng: 107.64, lat: 35.71 },
      { name: '定西', lng: 104.63, lat: 35.58 },
      { name: '陇南', lng: 104.93, lat: 33.40 },
      { name: '临夏', lng: 103.21, lat: 35.60 },
      { name: '甘南', lng: 102.91, lat: 34.99 }
    ]
  },
  {
    name: '青海',
    type: '省',
    cities: [
      { name: '西宁', lng: 101.78, lat: 36.62 },
      { name: '海东', lng: 102.10, lat: 36.50 },
      { name: '海北', lng: 100.90, lat: 36.96 },
      { name: '黄南', lng: 102.02, lat: 35.52 },
      { name: '海南州', lng: 100.62, lat: 36.29 },
      { name: '果洛', lng: 100.24, lat: 34.47 },
      { name: '玉树', lng: 97.01, lat: 33.00 },
      { name: '海西', lng: 97.37, lat: 37.37 }
    ]
  },
  {
    name: '宁夏',
    type: '自治区',
    cities: [
      { name: '银川', lng: 106.23, lat: 38.49 },
      { name: '石嘴山', lng: 106.38, lat: 39.02 },
      { name: '吴忠', lng: 106.20, lat: 37.99 },
      { name: '固原', lng: 106.28, lat: 36.00 },
      { name: '中卫', lng: 105.19, lat: 37.51 }
    ]
  },
  {
    name: '新疆',
    type: '自治区',
    cities: [
      {
        name: '乌鲁木齐', lng: 87.62, lat: 43.82,
        districts: ['天山区', '沙依巴克区', '新市区', '水磨沟区', '头屯河区', '达坂城区', '米东区', '乌鲁木齐县']
      },
      { name: '克拉玛依', lng: 84.89, lat: 45.58 },
      { name: '吐鲁番', lng: 89.19, lat: 42.95 },
      { name: '哈密', lng: 93.51, lat: 42.83 },
      { name: '昌吉', lng: 87.30, lat: 44.01 },
      { name: '博尔塔拉', lng: 82.07, lat: 44.90 },
      { name: '巴音郭楞', lng: 86.15, lat: 41.76 },
      { name: '阿克苏', lng: 80.26, lat: 41.17 },
      { name: '克孜勒苏', lng: 76.17, lat: 39.71 },
      { name: '喀什', lng: 75.99, lat: 39.47 },
      { name: '和田', lng: 79.92, lat: 37.11 },
      { name: '伊犁', lng: 81.32, lat: 43.92 },
      { name: '塔城', lng: 82.99, lat: 46.75 },
      { name: '阿勒泰', lng: 88.14, lat: 47.85 }
    ]
  },

  // ================= 台湾 =================
  {
    name: '台湾',
    type: '省',
    cities: [
      {
        name: '台北', lng: 121.52, lat: 25.03,
        districts: ['中正区', '大同区', '中山区', '松山区', '大安区', '万华区', '信义区', '士林区', '北投区', '内湖区', '南港区', '文山区']
      },
      { name: '新北', lng: 121.47, lat: 25.01 },
      { name: '桃园', lng: 121.30, lat: 24.99 },
      { name: '台中', lng: 120.68, lat: 24.15 },
      { name: '台南', lng: 120.21, lat: 22.99 },
      { name: '高雄', lng: 120.31, lat: 22.62 },
      { name: '基隆', lng: 121.74, lat: 25.13 },
      { name: '新竹', lng: 120.97, lat: 24.81 },
      { name: '嘉义', lng: 120.45, lat: 23.48 },
      { name: '宜兰', lng: 121.75, lat: 24.75 },
      { name: '花莲', lng: 121.61, lat: 23.98 },
      { name: '台东', lng: 121.15, lat: 22.76 },
      { name: '屏东', lng: 120.49, lat: 22.67 },
      { name: '澎湖', lng: 119.57, lat: 23.57 }
    ]
  }
];

// ---------------------------------------------------------------- 海外（可选）

/**
 * 海外城市。
 * 单独一组，因为它们的时区不是 +8 —— 上升星座折算要用当地时间，
 * 用错时区算出来的上升会整体偏差（一个时区差 15 度）。
 */
const OVERSEAS = [
  { name: '海外', type: '海外', cities: [
    { name: '东京', lng: 139.69, lat: 35.69, tz: 9 },
    { name: '首尔', lng: 126.98, lat: 37.57, tz: 9 },
    { name: '新加坡', lng: 103.82, lat: 1.35, tz: 8 },
    { name: '曼谷', lng: 100.50, lat: 13.76, tz: 7 },
    { name: '迪拜', lng: 55.27, lat: 25.20, tz: 4 },
    { name: '伦敦', lng: -0.13, lat: 51.51, tz: 0 },
    { name: '巴黎', lng: 2.35, lat: 48.86, tz: 1 },
    { name: '柏林', lng: 13.40, lat: 52.52, tz: 1 },
    { name: '纽约', lng: -74.01, lat: 40.71, tz: -5 },
    { name: '洛杉矶', lng: -118.24, lat: 34.05, tz: -8 },
    { name: '旧金山', lng: -122.42, lat: 37.77, tz: -8 },
    { name: '西雅图', lng: -122.33, lat: 47.61, tz: -8 },
    { name: '多伦多', lng: -79.38, lat: 43.65, tz: -5 },
    { name: '温哥华', lng: -123.12, lat: 49.28, tz: -8 },
    { name: '悉尼', lng: 151.21, lat: -33.87, tz: 10 },
    { name: '墨尔本', lng: 144.96, lat: -37.81, tz: 10 },
    { name: '奥克兰', lng: 174.76, lat: -36.85, tz: 12 }
  ]}
];

const ALL_REGIONS = PROVINCES.concat(OVERSEAS);

// ---------------------------------------------------------------- 显示名

/**
 * 省级全称。
 * 港澳台要带"中国"前缀（用户明确要求），自治区要用全称，
 * 海外不显示层级名（只显示城市本身）。
 */
const PROVINCE_FULL_NAME = {
  内蒙古: '内蒙古自治区',
  广西: '广西壮族自治区',
  西藏: '西藏自治区',
  宁夏: '宁夏回族自治区',
  新疆: '新疆维吾尔自治区',
  香港: '中国香港',
  澳门: '中国澳门',
  台湾: '中国台湾',
  海外: ''
};

/**
 * 地级名的后缀。
 * 默认加"市"，但这批是自治州 / 地区 / 盟，加"市"就成了错名字
 * （"延边市""阿里市"），所以单独列出来。'' 表示不加后缀。
 */
const CITY_SUFFIX = {
  延边: '州', 黔西南: '州', 黔东南: '州', 黔南: '州',
  阿坝: '州', 甘孜: '州', 凉山: '州',
  红河: '州', 文山: '州', 西双版纳: '州', 大理: '州', 德宏: '州', 怒江: '州', 迪庆: '州',
  临夏: '州', 甘南: '州', 恩施: '州', 湘西: '州',
  海北: '州', 黄南: '州', 果洛: '州', 玉树: '州', 海西: '州', 海南州: '',
  博尔塔拉: '州', 巴音郭楞: '州', 克孜勒苏: '州', 伊犁: '州',
  塔城: '地区', 阿勒泰: '地区', 阿里: '地区'
};

// ---------------------------------------------------------------- 查询

const PROVINCE_MAP = {};
ALL_REGIONS.forEach((p) => {
  PROVINCE_MAP[p.name] = p;
});

/** 全国省级名列表（第一列滚轮用） */
const PROVINCE_NAMES = ALL_REGIONS.map((p) => p.name);

function findProvince(name) {
  return PROVINCE_MAP[name] || null;
}

/** 某省下的城市名列表（第二列滚轮用） */
function cityNamesOf(provinceName) {
  const p = findProvince(provinceName);
  return p ? p.cities.map((c) => c.name) : [];
}

/** 把 (省, 城市条目) 包成统一的查询结果。时区没标的城市按 +8。 */
function wrap(p, c) {
  return {
    province: p.name,
    city: c.name,
    lng: c.lng,
    lat: c.lat,
    tz: typeof c.tz === 'number' ? c.tz : 8
  };
}

/**
 * 找城市。
 * 两个参数是正常用法；只给一个参数时按城市名全国搜 —— 老代码、老数据
 * （只存了一个 'city' 字符串）都走这条路，省得每个调用点都改。
 */
function findCity(provinceNameOrCity, cityName) {
  if (cityName === undefined || cityName === null || cityName === '') {
    return searchCity(provinceNameOrCity);
  }
  const p = findProvince(provinceNameOrCity);
  if (!p) return null;
  const c = p.cities.find((x) => x.name === cityName);
  return c ? wrap(p, c) : null;
}

/** 按城市名全国搜（返回带省名的完整结果） */
function searchCity(cityName) {
  const name = String(cityName || '').trim();
  if (!name) return null;
  for (let i = 0; i < ALL_REGIONS.length; i += 1) {
    const p = ALL_REGIONS[i];
    const c = p.cities.find((x) => x.name === name);
    if (c) return wrap(p, c);
  }
  // 传进来的直接是省名（比如 selftest 里随机的省级名）→ 用它第一个城市
  const p = findProvince(name);
  if (p && p.cities.length) return wrap(p, p.cities[0]);
  return null;
}

/** 省级全称（广东 → 广东省，北京 → 北京市，香港 → 中国香港） */
function provinceLabel(name) {
  if (PROVINCE_FULL_NAME[name] !== undefined) return PROVINCE_FULL_NAME[name];
  const p = findProvince(name);
  if (!p) return String(name || '');
  if (p.type === '直辖市') return `${name}市`;
  if (p.type === '自治区') return `${name}自治区`;
  return `${name}省`;
}

/**
 * 直辖市与特别行政区是"省市同名"的（北京市，没有"北京市市"），
 * 这种在展示串里要把市这一级省掉。
 * 注意吉林省吉林市是**两个不同层级**，名字相同但都要显示，所以不能只比名字。
 */
function sameAsProvince(province, cityName) {
  const p = findProvince(province);
  if (!p) return false;
  if (cityName !== p.name) return false;
  return p.type === '直辖市' || p.type === '特别行政区';
}

/** 地级全称（深圳 → 深圳市，延边 → 延边州，塔城 → 塔城地区） */
function cityFullName(provinceName, cityName) {
  const p = findProvince(provinceName);
  if (!p || p.type === '海外') return String(cityName || '');
  if (sameAsProvince(provinceName, cityName)) return String(cityName || '');
  const suffix = CITY_SUFFIX[cityName] === undefined ? '市' : CITY_SUFFIX[cityName];
  return `${cityName}${suffix}`;
}

/** 展示串：广东省 深圳市 南山区 / 北京市 东城区 / 中国香港 中西区 */
function placeLabel(o) {
  const src = o || {};
  if (src.cityLabel) return src.cityLabel;
  const parts = [];
  const p = src.province ? findProvince(src.province) : null;
  const overseas = !!(p && p.type === '海外');
  const pl = src.province ? provinceLabel(src.province) : '';
  if (pl) parts.push(pl);
  if (src.city && !(p && sameAsProvince(src.province, src.city))) {
    // 省市同名（北京市 / 中国香港）时市这一级不重复写
    parts.push(cityFullName(src.province, src.city));
  }
  if (src.district && !overseas) parts.push(src.district);
  return parts.join(' ') || '未提供';
}

/**
 * 把任意形态的"出生地"归一化成 { province, city, district, cityLabel }。
 *
 * 要能吃下三种输入：
 *   1. 新的三级数据 { province:'广东', city:'深圳', district:'南山区' }
 *   2. 老数据 { city:'杭州' }（只有一个城市名）→ 反查它属于哪个省
 *   3. 空 —— 回退到北京，和以前的默认值一致
 */
function placeOf(o) {
  const src = o || {};
  let province = String(src.province || '').trim();
  let city = String(src.city || '').trim();
  let district = String(src.district || '').trim();

  if (province && !findProvince(province)) province = '';

  // 老数据：只有城市名
  if (!province && city) {
    const hit = searchCity(city);
    if (hit) {
      province = hit.province;
      city = hit.city;
    }
  }

  if (province) {
    const p = findProvince(province);
    const c = p.cities.find((x) => x.name === city);
    if (!c) {
      // 省市对不上（用户在老版本选的是别的省的城市）→ 以城市名为准重找
      const hit = searchCity(city);
      if (hit) {
        province = hit.province;
        city = hit.city;
      } else {
        city = p.cities[0].name;
      }
    }
    const list = districtsOf(province, city);
    // 空的话从列表里取一个默认；用户已经选了的就留着 ——
    // 即便是我们没维护到明细的区县，也不该把用户的选择抹掉换成"市辖区"。
    if (!district) district = list.length ? list[0] : '';
  } else if (!city) {
    // 什么都没有 → 和以前的默认值一致
    province = '北京';
    city = '北京';
    district = districtsOf(province, city)[0];
  }
  // else：认不出的城市名（极少数，比如海外的冷门城市）。保留原样，
  // 既不硬套一个省，也不悄悄改成北京 —— 用户自己会重新选。

  const place = { province, city, district };
  place.cityLabel = placeLabel(place);
  return place;
}

/**
 * 某市的区县列表。
 * 没单独维护区县的城市统一回退成「市辖区」—— 选择体验三级一致，
 * 但不会为了填满数据而堆几千行（出生地只影响上升星座，市级精度已经够）。
 */
function districtsOf(provinceName, cityName) {
  const p = findProvince(provinceName);
  if (p && p.type === '海外') return ['市区']; // 海外城市没有"区县"，第三列给个占位，避免出现空列
  const c = p ? p.cities.find((x) => x.name === cityName) : null;
  if (c && Array.isArray(c.districts) && c.districts.length) return c.districts.slice();
  return ['市辖区'];
}

/**
 * 时区。国内（含港澳台）统一 +8；海外城市单独标了。
 * 不走 findCity —— 否则会和 findCity 互相调用绕成死循环。
 */
function tzOf(provinceNameOrCity, cityName) {
  if (cityName === undefined || cityName === null || cityName === '') {
    const hit = searchCity(provinceNameOrCity);
    return hit ? hit.tz : 8;
  }
  const p = findProvince(provinceNameOrCity);
  if (!p) return 8;
  const c = p.cities.find((x) => x.name === cityName);
  return c && typeof c.tz === 'number' ? c.tz : 8;
}

/**
 * 取经纬度。第三级（区县）不单独存坐标，直接继承市级 —— 精度足够。
 * 兼容旧的「只传城市名」调用方式，避免老代码一次性全改。
 */
/** 经纬度 + 时区。第三级（区县）不单独存坐标，直接继承市级 —— 精度足够。 */
function locate(provinceNameOrCity, cityName) {
  const hit = cityName === undefined ? searchCity(provinceNameOrCity) : findCity(provinceNameOrCity, cityName);
  if (!hit) {
    // 省市对不上时再按城市名兜一次
    const again = cityName === undefined ? null : searchCity(cityName);
    if (!again) return null;
    return again;
  }
  return hit;
}

/**
 * 全称 → 短名。
 *
 * 小程序版用的是原生 <picker mode="region">，它回给页面的是"广东省""深圳市"
 * 这种全称，而数据表里存的是短名，所以要反查一次。
 */
function shortProvinceName(full) {
  const s = String(full || '').trim();
  if (!s) return '';
  if (PROVINCE_MAP[s]) return s;
  const hit = ALL_REGIONS.find((p) => provinceLabel(p.name) === s || s.indexOf(p.name) === 0);
  return hit ? hit.name : s;
}

function shortCityName(province, full) {
  const p = findProvince(province);
  if (!p || !p.cities.length) return String(full || '');
  const s = String(full || '').trim();
  if (!s) return p.cities[0].name;
  const exact = p.cities.find((c) => c.name === s || cityFullName(province, c.name) === s);
  if (exact) return exact.name;
  const prefix = p.cities.find((c) => s.indexOf(c.name) === 0);
  return prefix ? prefix.name : p.cities[0].name;
}

/** 原生地区选择器回传的 ['广东省','深圳市','南山区'] → 统一的出生地 */
function placeFromRegion(region) {
  const arr = Array.isArray(region) ? region : [];
  const province = shortProvinceName(arr[0]);
  const city = shortCityName(province, arr[1]);
  return placeOf({ province, city, district: String(arr[2] || '').trim() });
}

/** 给"数据自检"用：省级行政区（含港澳台）+ 城市总数 */
function stats() {
  return {
    provinces: ALL_REGIONS.length,
    cities: ALL_REGIONS.reduce((s, p) => s + p.cities.length, 0),
    withDistricts: ALL_REGIONS.reduce(
      (s, p) => s + p.cities.filter((c) => Array.isArray(c.districts) && c.districts.length).length,
      0
    )
  };
}

module.exports = {
  PROVINCES: ALL_REGIONS,
  PROVINCE_NAMES,
  findProvince,
  findCity,
  searchCity,
  cityNamesOf,
  districtsOf,
  tzOf,
  locate,
  provinceLabel,
  cityFullName,
  placeLabel,
  placeOf,
  shortProvinceName,
  shortCityName,
  placeFromRegion,
  stats
};
