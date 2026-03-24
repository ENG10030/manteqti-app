import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const developerEmail = process.env.DEVELOPER_EMAIL || 'ahmadmamdouh10030@gmail.com'
  const developerPassword = process.env.DEVELOPER_PASSWORD || 'admin123'

  // التحقق من وجود المطور
  const existingDeveloper = await prisma.user.findUnique({
    where: { identifier: developerEmail }
  })

  if (existingDeveloper) {
    console.log('المطور موجود بالفعل')
    return
  }

  // إنشاء حساب المطور
  const hashedPassword = await hash(developerPassword, 12)

  const developer = await prisma.user.create({
    data: {
      name: 'المطور',
      identifier: developerEmail,
      password: hashedPassword,
      role: 'developer',
      isBlocked: false
    }
  })

  console.log('تم إنشاء حساب المطور:', developer.identifier)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })