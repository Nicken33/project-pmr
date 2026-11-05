package httpx

import (
	"encoding/json"
	"log"
	"net/http"
)

// §9: ошибки одного вида — {error: {code, message, fields}}. `code` совпадает с
// HTTP-статусом, `fields` заполняется только на 400 и на 409 по конкретному полю.
type Envelope struct {
	Code    int               `json:"code"`
	Message string            `json:"message"`
	Fields  map[string]string `json:"fields,omitempty"`
}

type apiError struct {
	status  int
	message string
	fields  map[string]string
}

func (e *apiError) Error() string { return e.message }

// Status достаёт HTTP-код из ошибки; для ошибок, пришедших не отсюда, — 500.
func Status(err error) int {
	if e, ok := err.(*apiError); ok {
		return e.status
	}
	return http.StatusInternalServerError
}

// Fields отдаёт карту «поле → подсказка» из 400. Нужна тестам и будущим
// логгерам, наружу карта уходит только внутри конверта.
func Fields(err error) map[string]string {
	if e, ok := err.(*apiError); ok {
		return e.fields
	}
	return nil
}

func NewError(status int, message string, fields map[string]string) error {
	return &apiError{status: status, message: message, fields: fields}
}

func NewBadRequest(fields map[string]string) error {
	return NewError(http.StatusBadRequest, "проверь поля", fields)
}

func NewNotFound(message string) error {
	return NewError(http.StatusNotFound, message, nil)
}

// WriteJSON отдаёт JSON с явным charset: без него часть клиентов считает ответ
// текстом в локальной кодировке, а кириллица в названии занятия — норма.
func WriteJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(body); err != nil {
		log.Printf("не удалось записать тело ответа: %v", err)
	}
}

// WriteError пишет конверт §9. Внутренние детали наружу не уходят: сообщение об
// ошибке БД может содержать имена таблиц и фрагменты запроса. Но в лог они
// обязаны попасть (§6.7), иначе 500 на стенде неразбираем.
func WriteError(w http.ResponseWriter, err error) {
	if e, ok := err.(*apiError); ok {
		WriteJSON(w, e.status, struct {
			Error Envelope `json:"error"`
		}{Envelope{Code: e.status, Message: e.message, Fields: e.fields}})
		return
	}

	log.Printf("внутренняя ошибка запроса: %v", err)
	const status = http.StatusInternalServerError
	WriteJSON(w, status, struct {
		Error Envelope `json:"error"`
	}{Envelope{Code: status, Message: "серверная ошибка, попробуй позже"}})
}
