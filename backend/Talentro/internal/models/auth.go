package models

// RoleTester — единственная роль, дающая доступ к тестовым разделам витрины.
const RoleTester = "tester"

// GoogleProfile — claims ID-токена, которые мы реально используем.
type GoogleProfile struct {
	Sub           string `json:"sub"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Picture       string `json:"picture"`
	EmailVerified bool   `json:"email_verified"`
}

// User — строка канонической таблицы users (§7), какой её видит авторизация.
// account_type в схеме заменяет роль, avatar_path — колонку avatar_url из
// прежней модели, поэтому наружу они отдаются под привычными именами.
// Поля БД NULL-able, поэтому в модели пустая строка означает «не заполнено».
type User struct {
	ID        int64  `json:"id"`
	Email     string `json:"email"`
	Name      string `json:"name"`
	AvatarURL string `json:"avatar_url"`
	Provider  string `json:"provider"`
	Role      string `json:"role"`
}
