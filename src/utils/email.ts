import { createTransport, Transporter } from 'nodemailer';
import process from 'node:process';

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (transporter) {
    return transporter;
  }

  const gmailAddress = process.env.GMAIL_ADDRESS;
  const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

  if (!gmailAddress || !gmailAppPassword) {
    throw new Error(
      'GMAIL_ADDRESS または GMAIL_APP_PASSWORD が設定されていません。'
    );
  }

  transporter = createTransport({
    service: 'gmail',
    auth: {
      user: gmailAddress,
      pass: gmailAppPassword,
    },
  });

  return transporter;
}

/**
 * 認証コードを含むメールを送信する。
 * @param to - 送信先メールアドレス
 * @param code - 6桁の認証コード
 * @throws メール送信に失敗した場合
 */
export async function sendVerificationCodeEmail(
  to: string,
  code: string
): Promise<void> {
  const gmailAddress = process.env.GMAIL_ADDRESS;
  if (!gmailAddress) {
    throw new Error('GMAIL_ADDRESS が設定されていません。');
  }

  const mailOptions = {
    from: `IPUT Esports Discord Bot <${gmailAddress}>`,
    to,
    subject: 'IPUT Esports Discord Bot - 認証コード',
    text: `認証コード: ${code}\n\nこのコードは5分間有効です。\n\nIPUT Esports Discord Bot`,
  };

  await getTransporter().sendMail(mailOptions);
}
