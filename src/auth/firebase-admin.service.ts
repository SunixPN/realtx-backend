import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { cert, getApps, initializeApp, type App } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private app!: App;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const existing = getApps();
    if (existing.length > 0) {
      this.app = existing[0]!;
      return;
    }

    const projectId = this.config.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.config.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKeyRaw = this.config.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKeyRaw) {
      throw new Error('Firebase credentials в .env не заполнены');
    }

    // В .env private key хранится с литеральными \n — превращаем их в реальные переносы строк
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

    this.app = initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });

    this.logger.log(`Firebase Admin SDK инициализирован для проекта ${projectId}`);
  }

  /**
   * Проверяет ID токен, полученный с фронта после Phone Auth.
   * Возвращает номер телефона юзера в формате E.164 (например, +375291234567).
   */
  async verifyPhoneToken(idToken: string): Promise<{ phone: string }> {
    let decoded: DecodedIdToken;

    try {
      decoded = await getAuth(this.app).verifyIdToken(idToken);
    } catch (err) {
      this.logger.warn(`Невалидный Firebase ID токен: ${(err as Error).message}`);
      throw new UnauthorizedException('Невалидный Firebase токен');
    }

    // Защита от подсовывания токена, полученного через Google/email:
    // мы принимаем только токены из Phone Auth flow
    const signInProvider = decoded.firebase?.sign_in_provider;
    if (signInProvider !== 'phone') {
      this.logger.warn(`Попытка использовать токен от провайдера "${signInProvider}"`);
      throw new UnauthorizedException('Токен должен быть получен через Phone Auth');
    }

    const phone = decoded.phone_number;
    if (!phone) {
      throw new UnauthorizedException('Токен не содержит номер телефона');
    }

    return { phone };
  }
}
