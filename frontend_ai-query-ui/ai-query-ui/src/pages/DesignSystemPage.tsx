import { useState } from 'react'
import { Button } from '../components/ui/Button'
import { DatePicker } from '../components/ui/DatePicker'
import { Input } from '../components/ui/Input'
import { Select } from '../components/ui/Select'
import { Textarea } from '../components/ui/Textarea'
import { Badge } from '../components/ui/Badge'
import { Dialog } from '../components/ui/Dialog'
import { KpiCard } from '../components/ui/KpiCard'
import { Tabs } from '../components/ui/Tabs'
import { EmptyState } from '../components/ui/EmptyState'
import { PageHeader } from '../components/layout/PageHeader'
import { Activity } from 'lucide-react'

export function DesignSystemPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [tab, setTab] = useState('buttons')
  const [sampleDate, setSampleDate] = useState('1403/12/01')

  return (
    <div className="mx-auto max-w-5xl p-8">
      <PageHeader
        title="سیستم طراحی"
        description="کامپوننت‌های پایه برای پنل‌های مدیریتی سامانه"
      />

      <Tabs
        activeId={tab}
        onChange={setTab}
        tabs={[
          {
            id: 'buttons',
            label: 'دکمه‌ها و نشان‌ها',
            content: (
              <div className="space-y-6">
                <div className="flex flex-wrap gap-2">
                  <Button>اصلی</Button>
                  <Button variant="secondary">ثانویه</Button>
                  <Button variant="outline">حاشیه‌دار</Button>
                  <Button variant="ghost">شفاف</Button>
                  <Button variant="danger">حذف</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>پیش‌فرض</Badge>
                  <Badge variant="success">فعال</Badge>
                  <Badge variant="warning">در انتظار</Badge>
                  <Badge variant="danger">خطا</Badge>
                  <Badge variant="info">اطلاعات</Badge>
                  <Badge variant="neutral">خنثی</Badge>
                </div>
              </div>
            ),
          },
          {
            id: 'forms',
            label: 'فرم‌ها',
            content: (
              <div className="grid max-w-xl gap-4">
                <Input label="نام" placeholder="کاربر نمونه 17" />
                <Select
                  label="وضعیت"
                  options={[
                    { value: 'active', label: 'فعال' },
                    { value: 'inactive', label: 'غیرفعال' },
                  ]}
                />
                <DatePicker
                  label="تاریخ شمسی"
                  value={sampleDate}
                  onChange={setSampleDate}
                  hint="مقدار ذخیره‌شده: YYYY/MM/DD با ارقام انگلیسی"
                />
                <Textarea label="توضیحات" placeholder="متن توضیحات..." />
              </div>
            ),
          },
          {
            id: 'feedback',
            label: 'کارت و دیالوگ',
            content: (
              <div className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <KpiCard
                    title="تعداد درخواست"
                    value="۱۲٬۴۸۰"
                    hint="۳۰ روز اخیر"
                    trend="+۸٪ نسبت به ماه قبل"
                    icon={<Activity className="size-5" />}
                  />
                </div>
                <Button onClick={() => setDialogOpen(true)}>باز کردن دیالوگ</Button>
                <EmptyState
                  title="موردی وجود ندارد"
                  description="برای شروع یک مورد جدید اضافه کنید."
                  action={<Button size="sm">افزودن</Button>}
                />
                <Dialog
                  open={dialogOpen}
                  title="نمونه دیالوگ"
                  onClose={() => setDialogOpen(false)}
                  footer={
                    <>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        انصراف
                      </Button>
                      <Button onClick={() => setDialogOpen(false)}>تأیید</Button>
                    </>
                  }
                >
                  این یک دیالوگ نمونه برای سیستم طراحی است.
                </Dialog>
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
