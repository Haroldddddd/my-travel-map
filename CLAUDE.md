# 旅行足迹地图 — 项目背景与架构

## 项目定位
个人旅行足迹记录网站，全客户端运行（无后端），部署目标 GitHub Pages（公开仓库）。
- 展示国内/国际去过的所有城市，高德地图可视化
- 支持上传照片，从 EXIF GPS 提取位置和时间自动记录足迹
- 照片缩略图（400px wide JPEG）存 IndexedDB 本地缓存 + 持久化到 GitHub 仓库
- 城市元数据持久化到 GitHub 仓库 `user-data/cities.json`

## 技术栈

| 用途 | 库 |
|------|-----|
| 框架 | Vite + React 19 |
| 地图渲染 | 高德地图 JS API v2.0（AMap） |
| EXIF 读取 | exifr.js（支持 JPEG/HEIC GPS） |
| HEIC 转换 | heic2any（动态 import，按需加载） |
| 正向/反向地理编码 | Nominatim OSM API（免费，1 req/sec，共享限速器） |
| 照片存储 | IndexedDB via `idb`（本地缓存）+ GitHub API（持久化） |
| 城市数据 | localStorage（读缓存）+ GitHub `user-data/cities.json`（持久化） |
| 唯一 ID | uuid v4 |
| 字体 | Noto Sans SC（中文正文）+ Caveat（数字/英文手写）+ DM Sans |
| 部署 | GitHub Pages，`vite.config.js` base: './' |

## 地图方案

**国内地图**（`ChinaMapAmap.jsx`）：
- `AMap.DistrictLayer.Province` depth:0 — 省级边界线（`#a8a49e`，1.2px）
- `AMap.DistrictLayer.Province` depth:1 — 市级边界线（`#ccc9c3`，0.35px，透明填充）
- 城市高亮：`AMap.Geocoder.getAddress()` 反向解析坐标 → 获取 adcode → 从 Datav CDN 拉取 GeoJSON → 绘制多边形
  - Datav CDN：`https://geo.datav.aliyun.com/areas_v3/bound/{adcode}.json`（静态，无鉴权，无限速）
  - adcode 规则：直辖市（11/12/31/50 开头）用省级 adcode（`XX0000`），其他城市用地级市 adcode（`XXXX00`）
  - 每次 geocode 请求间隔 200ms，使用 `drawVersion` 计数器取消过时请求
- **禁止使用 `AMap.DistrictSearch` 做高亮**：其 `4096` 后端会取消所有并发请求，无论创建多少实例
- `features: ['bg']` 保留底图背景色（陆地浅灰，海洋蓝）
- 省/市 layer 填充均为 transparent，让高亮多边形从底图上方叠加显示

**国际地图**（`WorldMapAmap.jsx`）：
- `AMap.DistrictLayer.World` — 国家轮廓（`#f0eeea` 填充，`#b0aca6` 边界）
- 国家高亮：`fetchCountryBoundary(city.country)` → Nominatim `polygon_geojson=1` → 绘制多边形
  - 按 `city.country`（中文国家名）查询，Nominatim 支持中文输入
  - `polygon_threshold=0.01` 简化几何，减少渲染压力
  - 结果按国家名缓存（`countryGeoCache` Map），同一国家只拉取一次
  - 顺序处理，共享 Nominatim 限速器（1100ms/req）
- `features: []` 不加载底图瓦片，海洋用容器背景色 `#c2d8e8`

**共用加载器**（`amapLoader.js`）：
- 模块级单例，保证 AMap 脚本只加载一次
- 插件：`AMap.DistrictLayer,AMap.DistrictSearch,AMap.AutoComplete,AMap.Geocoder`
- Key: `8ad968e6453ff99c9ab74653e48965ed` / SecKey: `a595be07343ab4925d4d804ef041c59c`
- 项目只有 JS API key，**没有 REST API key**，不能调用 `restapi.amap.com` 或 `international.amap.com`

## 城市搜索（`CitySearchInput.jsx`）

- **国内城市**：`AMap.DistrictSearch`，过滤掉纯省级（非直辖市）和国家级结果，`province` 字段由 `adcodeProvince.js` 从 adcode 推导
- **境外城市**：`searchInternationalCities(query)`（`geocoder.js`）→ Nominatim 正向地理编码，过滤掉 `country_code === 'cn'` 的结果
- 两者并行请求（`Promise.allSettled`），300ms debounce
- `adcodeProvince.js`：adcode 前两位 → 省份名静态映射表，供 `CitySearchInput` 和任何需要的模块使用

## 数据持久化方案（GitHub API）

**存储结构（仓库内）**：
```
user-data/
├── cities.json          # 城市元数据数组
└── photos/
    └── {cityId}/
        └── {photoId}.jpg  # 照片缩略图
```

**服务层**（`src/services/github.js`）：
- `isConfigured()` — 检查 token/owner/repo 是否已配置
- `loadCities()` / `saveCities(cities)` — 读写 cities.json，追踪 SHA 避免冲突
- `uploadPhoto(cityId, photoId, blob)` — 上传缩略图
- `deletePhoto(cityId, photoId)` — 删除单张照片
- `getPhotoUrl(cityId, photoId)` — 返回 `raw.githubusercontent.com` 直链（仅 public 仓库有效）
- `setupAndInit(token, ownerRepo, existingCities)` — 首次配置：验证连接，推送本地数据
- 配置存 localStorage：`travel-map:gh`（token/owner/repo）、`travel-map:gh-sha`（cities.json 的 SHA）

**读写策略**：
- 写入：同时写 localStorage 缓存 + 调用 `github.saveCities()`
- 照片：写入 IndexedDB（立即可用）+ 上传 GitHub（持久化）
- 读取：启动时从 GitHub 加载最新数据，与本地 only 城市合并后覆盖缓存

## 设计风格

- **地图**：高亮区域暖橙色 `#f5c896`，底图浅灰暖色系
- **其他 UI**：扁平简洁，参考小红书地点页风格
- **禁止使用 emoji**：图标全用内联 SVG
- **中文字体**：一律 Noto Sans SC；Caveat 只用于日期、英文标签、数字
- Toolbar 副标题：「every step counts」

## 项目结构

```
src/
├── App.jsx                    # 顶层状态 + GitHub 初始化 + 首次设置流程
├── mockData.js                # 示例城市（国内+国际）
├── index.css                  # CSS 变量系统 + 所有组件样式
├── components/
│   ├── map/
│   │   ├── MapSVG.jsx         # tab 路由：domestic→ChinaMapAmap，else→WorldMapAmap
│   │   ├── ChinaMapAmap.jsx   # 国内高德地图 + 省/市边界 + 城市高亮（Geocoder+Datav）
│   │   └── WorldMapAmap.jsx   # 国际高德地图 + 世界边界 + 国家高亮（Nominatim）
│   ├── layout/
│   │   ├── Sidebar.jsx        # 左侧边栏：logo + 搜索 + 导航 + 最近到访（照片缩略图）
│   │   └── Toolbar.jsx        # 顶部工具栏：标题 + Tab + 统计（国家硬编码11/城市数/照片数）+ 上传按钮
│   ├── setup/
│   │   └── GithubSetupModal.jsx  # 首次 GitHub 连接配置弹窗
│   ├── city/
│   │   ├── CityDetailPanel.jsx  # 右侧滑入面板：统计/到访记录/照片/备注编辑/上传
│   │   └── CityListView.jsx     # 全屏城市列表
│   ├── upload/
│   │   ├── RecordModal.jsx    # 记录新地点/上传照片弹窗（EXIF+城市搜索+日期+备注）
│   │   └── CitySearchInput.jsx # 城市搜索（AMap国内 + Nominatim国际，300ms debounce）
│   └── MarkerCard.jsx         # 地图上点击城市的弹出卡片
├── hooks/
│   └── useExifExtract.js      # 并行 EXIF 提取（GPS + 时间戳）
└── services/
    ├── github.js              # GitHub API 客户端（城市+照片读写）
    ├── storage.js             # localStorage 缓存：getCities/saveCities/addCity/updateCity/deleteCity
    ├── photoDB.js             # IndexedDB 本地缓存 + GitHub 照片上传/读取
    ├── amapLoader.js          # AMap 脚本单例加载器
    ├── adcodeProvince.js      # adcode前两位→省份名静态映射 + provinceFromAdcode()
    └── geocoder.js            # Nominatim：反向编码/正向城市搜索/国家边界拉取（共享限速器）
```

## 数据模型

```js
// GitHub user-data/cities.json（同步到 localStorage 缓存）
City = {
  id: string,           // uuid
  name: string,
  country: string,
  province: string | null,  // 国内城市有省份（由 adcodeProvince.js 从 adcode 推导）
  lat, lng: number,
  domestic: boolean,
  adcode: string,       // 6位行政区划码（国内城市，境外为空）
  firstVisit: 'YYYY-MM-DD',
  note: string,
  color: string,        // 卡片背景色（十六进制）
  visits: [{ startDate, endDate, photoCount }],
  photos: [photoId],    // 照片 ID 列表，对应 GitHub photos/{cityId}/{photoId}.jpg
}

// IndexedDB 'travel-photos' store（本地缓存，跨 session 保留）
Photo = {
  id: string,           // 即 photoId，与 GitHub 路径对应
  cityId: string,
  date: Date,
  thumbnailBlob: Blob,  // 400px wide JPEG
  originalFilename: string
}
```

## 关键注意事项

1. **GitHub SHA 追踪**：每次 PUT cities.json 需要提供当前文件 SHA，否则报 409。SHA 存 localStorage `travel-map:gh-sha`；写入后用响应中的新 SHA 更新
2. **照片加载顺序**：先查 IndexedDB（有 thumbnailBlob 则用 createObjectURL），没有再用 `raw.githubusercontent.com` 直链（仅 public 仓库）
3. **AMap DistrictSearch 并发陷阱**：其 `4096` 后端取消所有并发 XHR，无论创建多少实例。国内高亮已改用 Geocoder+Datav，国际高亮已改用 Nominatim，不要再用 DistrictSearch 做高亮
4. **DistrictLayer 遮挡**：高亮 Polygon 需 zIndex:20 才能显示在省界填充上方；省界 layer 填充设为 transparent
5. **AMap 坐标系**：GCJ-02（火星坐标）。Nominatim 返回 WGS-84，在国内地图上有偏移（视觉可接受）；世界地图不涉及偏移
6. **heic2any 动态 import**：`useExifExtract.js` 按需加载，已在 vite.config.js 加 `optimizeDeps.include`
7. **feTurbulence 滤镜**：已移除，不要加回（曾导致省份填充消失）
8. **中文不用手写字体**：Caveat 只用于英文和数字
9. **构建方式**：`npm run build` 后 `npx serve dist`（port 3000）。每次修改必须重新 build，无热更新
10. **Toolbar 国家数统计**：国内 tab 显示「国家」固定值 11，非实时计算

## 「记录新地点」功能流程

1. 点击「记录新地点」→ `RecordModal` 弹出
2. 上传照片 → `useExifExtract.processFiles()` 并行提取 EXIF
3. 取最早时间 → `startDate`；对第一个有 GPS 的照片调用 `geocodeCoords` → 预填城市
4. 保存：先上传照片（IndexedDB + GitHub），再保存城市（localStorage + GitHub）
5. 城市对象包含 `photos: [photoId, ...]` 字段追踪关联照片

## CityDetailPanel 功能

- 右侧滑入面板，点击地图标记「查看详情」打开
- 展示：访问次数/照片数/首次到访时间、到访记录（去重）、照片网格（点击放大）
- 备注（note）支持内联编辑：点击进入编辑，Enter 保存，Escape 取消，失焦自动保存
- 底部：「上传照片」（打开 RecordModal editCity 模式）+ 「删除」按钮
- `refreshKey` prop 控制照片重新加载（上传后 bump）
- 支持删除单张照片（hover 显示删除按钮）
- 支持删除单条到访记录（hover 显示删除按钮，不删除关联照片）
