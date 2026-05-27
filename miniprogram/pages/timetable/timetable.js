const { request, showError } = require('../../utils/request')

const weekdays = [
  { value: 1, label: '周一', short: '一' },
  { value: 2, label: '周二', short: '二' },
  { value: 3, label: '周三', short: '三' },
  { value: 4, label: '周四', short: '四' },
  { value: 5, label: '周五', short: '五' },
  { value: 6, label: '周六', short: '六' },
  { value: 7, label: '周日', short: '日' }
]

Page({
  data: {
    token: '',
    term: '',
    studentNo: '',
    password: '',
    courses: [],
    todayCourses: [],
    selectedCourses: [],
    weekdays,
    weekdayTabs: weekdays,
    selectedWeekday: 1,
    loading: false,
    importing: false,
    showImportForm: true
  },

  onLoad() {
    const today = toCampusWeekday(new Date().getDay())
    this.setData({
      token: wx.getStorageSync('token') || '',
      term: defaultTerm(),
      selectedWeekday: today
    })
  },

  onShow() {
    const token = wx.getStorageSync('token') || ''
    this.setData({ token })
    if (token) {
      this.loadTimetable()
    }
  },

  onPullDownRefresh() {
    this.loadTimetable().finally(() => wx.stopPullDownRefresh())
  },

  async login() {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onTermInput(e) {
    this.setData({ term: e.detail.value })
  },

  onStudentNoInput(e) {
    this.setData({ studentNo: e.detail.value })
  },

  onPasswordInput(e) {
    this.setData({ password: e.detail.value })
  },

  toggleImportForm() {
    this.setData({ showImportForm: !this.data.showImportForm })
  },

  selectWeekday(e) {
    const weekday = Number(e.currentTarget.dataset.weekday)
    this.setData({
      selectedWeekday: weekday,
      selectedCourses: coursesForWeekday(this.data.courses, weekday)
    })
  },

  async loadTimetable() {
    if (!this.data.token || this.data.loading) return
    this.setData({ loading: true })
    try {
      const data = await request({
        url: '/campus/timetable',
        data: { term: this.data.term }
      })
      this.applyTimetable(data.term || this.data.term, data.courses || [])
    } catch (err) {
      showError(err)
    } finally {
      this.setData({ loading: false })
    }
  },

  async importTimetable() {
    if (!this.data.token) {
      this.login()
      return
    }
    if (this.data.importing) return
    const studentNo = this.data.studentNo.trim()
    const password = this.data.password.trim()
    if (studentNo.length < 4) {
      wx.showToast({ title: '请输入学号', icon: 'none' })
      return
    }
    if (password.length < 4) {
      wx.showToast({ title: '请输入教务密码', icon: 'none' })
      return
    }
    this.setData({ importing: true })
    try {
      const data = await request({
        url: '/campus/timetable/import',
        method: 'POST',
        data: {
          student_no: studentNo,
          password,
          term: this.data.term
        }
      })
      this.applyTimetable(data.term || this.data.term, data.courses || [])
      this.setData({ password: '', showImportForm: false })
      wx.showToast({ title: `已导入 ${data.count || 0} 门课`, icon: 'none' })
    } catch (err) {
      this.setData({ password: '' })
      showError(err)
    } finally {
      this.setData({ importing: false })
    }
  },

  applyTimetable(term, rawCourses) {
    const courses = normalizeCourses(rawCourses)
    const selectedWeekday = this.data.selectedWeekday || toCampusWeekday(new Date().getDay())
    this.setData({
      term,
      courses,
      todayCourses: coursesForWeekday(courses, toCampusWeekday(new Date().getDay())),
      selectedCourses: coursesForWeekday(courses, selectedWeekday),
      weekdayTabs: buildWeekdayTabs(courses),
      showImportForm: courses.length === 0
    })
  }
})

function normalizeCourses(courses) {
  return (courses || []).map(course => ({
    ...course,
    weekday: Number(course.weekday || 0),
    start_section: Number(course.start_section || 0),
    end_section: Number(course.end_section || 0),
    start_week: Number(course.start_week || 1),
    end_week: Number(course.end_week || 20),
    week_parity: Number(course.week_parity || 0),
    time_label: `第${course.start_section}-${course.end_section}节`,
    week_label: formatWeekLabel(course)
  })).sort((a, b) => {
    if (a.weekday !== b.weekday) return a.weekday - b.weekday
    if (a.start_section !== b.start_section) return a.start_section - b.start_section
    return String(a.id).localeCompare(String(b.id))
  })
}

function coursesForWeekday(courses, weekday) {
  return (courses || []).filter(course => course.weekday === weekday)
}

function buildWeekdayTabs(courses) {
  return weekdays.map(day => ({
    ...day,
    count: coursesForWeekday(courses, day.value).length
  }))
}

function formatWeekLabel(course) {
  const start = Number(course.start_week || 1)
  const end = Number(course.end_week || start)
  const parity = Number(course.week_parity || 0)
  const parityText = parity === 1 ? ' 单周' : parity === 2 ? ' 双周' : ''
  return `${start}-${end}周${parityText}`
}

function toCampusWeekday(jsDay) {
  return jsDay === 0 ? 7 : jsDay
}

function defaultTerm() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  if (month < 8) {
    return `${year - 1}-${year}-2`
  }
  return `${year}-${year + 1}-1`
}
