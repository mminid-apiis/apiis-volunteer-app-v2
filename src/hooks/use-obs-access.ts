import { useMutation, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { AttendanceRecord } from '@/types'
import type { GroupStudent } from '@/hooks/use-groups'

export interface ObsVolunteer {
  id: string
  full_name: string
}

export interface ObsGroup {
  cohort_id: string
  cohort_name: string
  group_id: string
  group_name: string
}

export interface ObsAccessLogRow {
  id: string
  volunteer_id: string | null
  full_name: string | null
  action: 'enter' | 'save_attendance'
  group_id: string | null
  group_name: string | null
  class_name: string | null
  session_date: string | null
  device_info: string | null
  ip_address: string | null
  created_at: string
}

/** 验证共享访问码 + 选定身份;成功会记一条 "enter" 日志。 */
export function useObsVerify() {
  return useMutation({
    mutationFn: async (vars: { code: string; volunteerId: string; deviceInfo: string }) => {
      const { data, error } = await supabase.rpc('obs_verify', {
        p_code: vars.code,
        p_volunteer_id: vars.volunteerId,
        p_device_info: vars.deviceInfo,
      })
      if (error) throw error
      return data as boolean
    },
  })
}

/** "我是谁" 下拉用的志愿者名单;code 无效时后端返回空列表(不是报错)。 */
export function useObsVolunteers(code: string) {
  return useQuery({
    queryKey: ['obs-volunteers', code],
    enabled: code.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('obs_list_volunteers', { p_code: code })
      if (error) throw error
      return (data ?? []) as ObsVolunteer[]
    },
  })
}

/** 全部班级 + 小组(不受 assignments 限制)。 */
export function useObsGroups(code: string | null) {
  return useQuery({
    queryKey: ['obs-groups', code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('obs_list_groups', { p_code: code as string })
      if (error) throw error
      return (data ?? []) as ObsGroup[]
    },
  })
}

/** 某组学员名单(仅 id + 姓名)。 */
export function useObsGroupStudents(code: string | null, groupId: string | undefined) {
  return useQuery({
    queryKey: ['obs-students', code, groupId],
    enabled: !!code && !!groupId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('obs_group_students', {
        p_code: code as string,
        p_group_id: groupId,
      })
      if (error) throw error
      return (data ?? []) as GroupStudent[]
    },
  })
}

/** 某组某次课已存在的评估。 */
export function useObsAttendance(code: string | null, groupId: string | undefined, sessionDate: string) {
  return useQuery({
    queryKey: ['obs-attendance', code, groupId, sessionDate],
    enabled: !!code && !!groupId && !!sessionDate,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('obs_get_attendance', {
        p_code: code as string,
        p_group_id: groupId,
        p_session_date: sessionDate,
      })
      if (error) throw error
      return (data ?? []) as AttendanceRecord[]
    },
  })
}

/** 保存评估(批量 upsert)+ 记一条 "save_attendance" 日志。 */
export function useObsSaveAttendance() {
  return useMutation({
    mutationFn: async (vars: {
      code: string
      volunteerId: string
      deviceInfo: string
      groupId: string
      sessionDate: string
      rows: { student_id: string; contribution: number | null; notes: string }[]
    }) => {
      const { error } = await supabase.rpc('obs_save_attendance', {
        p_code: vars.code,
        p_volunteer_id: vars.volunteerId,
        p_device_info: vars.deviceInfo,
        p_group_id: vars.groupId,
        p_session_date: vars.sessionDate,
        p_rows: vars.rows,
      })
      if (error) throw error
    },
  })
}

/** 提交反馈(免登录模式;走 SECURITY DEFINER 绕过 feedback 表的 auth.uid() RLS)。 */
export function useObsSubmitFeedback() {
  return useMutation({
    mutationFn: async (vars: { code: string; volunteerId: string; message: string }) => {
      const { error } = await supabase.rpc('obs_submit_feedback', {
        p_code: vars.code,
        p_volunteer_id: vars.volunteerId,
        p_message: vars.message,
      })
      if (error) throw error
    },
  })
}

/** 管理员:OBS 免登录模式的访问日志(RLS 已限制仅 admin 可读)。 */
export function useObsAccessLog() {
  return useQuery({
    queryKey: ['obs-access-log'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('obs_access_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) throw error
      return (data ?? []) as ObsAccessLogRow[]
    },
  })
}
